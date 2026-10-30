const mongoose = require("mongoose");
const Order = require("../../../../db/models/orderModel");
require("../../../../db/models/offerModel");
const Shipment = require("../../../../db/models/shipmentModel");
const Product = require("../../../../db/models/productModel");
const User = require("../../../../db/models/userModel");
const NotificationService = require("../../../../services/NotificationService");
// const NotificationController=require("../../notifications/controllers/notificationController")
const OrderEmailService = require("../../../../services/OrderEmailService");

class OrderController {
  extractTrackingFromDescription(description) {
    if (!description) return null;

    try {
      // Pattern: "Shipped via {provider} - Tracking: {trackingNumber}"
      const trackingRegex =
        /Shipped via\s+([^\s-]+)\s*-\s*Tracking:\s*([^\s,;]+)/i;
      const match = description.match(trackingRegex);

      if (match) {
        return {
          provider: match[1].trim(),
          trackingNumber: match[2].trim(),
        };
      }

      // Alternative pattern: "Tracking: {trackingNumber}"
      const simpleTrackingRegex = /Tracking:\s*([^\s,;]+)/i;
      const simpleMatch = description.match(simpleTrackingRegex);

      if (simpleMatch) {
        return {
          provider: "Unknown",
          trackingNumber: simpleMatch[1].trim(),
        };
      }

      return null;
    } catch (error) {
      console.error("Error extracting tracking info:", error);
      return null;
    }
  }

  // Create a simple Cash on Delivery order
  async createCodOrder(req, res) {
    try {
      const userId = req.user._id;
      const {
        productId,
        sellerId,
        totalAmount,
        shippingAddress,
        paymentMethod,
        quantity = 1,
      } = req.body;

      // Basic validation
      if (!productId) {
        console.error("Missing productId");
        return res
          .status(400)
          .json({ success: false, error: "productId is required" });
      }
      if (!sellerId) {
        console.error("Missing sellerId");
        return res
          .status(400)
          .json({ success: false, error: "sellerId is required" });
      }
      // Convert totalAmount to number if it's a string
      const numericTotalAmount =
        typeof totalAmount === "string" ? parseFloat(totalAmount) : totalAmount;
      if (typeof numericTotalAmount !== "number" || isNaN(numericTotalAmount)) {
        console.error("Invalid totalAmount:", totalAmount, typeof totalAmount);
        return res
          .status(400)
          .json({
            success: false,
            error: "totalAmount must be a valid number",
          });
      }

      // Validate quantity
      const numericQuantity = parseInt(quantity);
      if (isNaN(numericQuantity) || numericQuantity < 1) {
        console.error("Invalid quantity:", quantity);
        return res
          .status(400)
          .json({
            success: false,
            error: "Quantity must be a positive number",
          });
      }
      if (
        !shippingAddress ||
        !shippingAddress.fullName ||
        !shippingAddress.phoneNumber ||
        !(shippingAddress.street1 || shippingAddress.streetAddress) ||
        !shippingAddress.city ||
        !shippingAddress.country ||
        !(shippingAddress.zipCode || shippingAddress.zip)
      ) {
        console.error("Incomplete shippingAddress:", shippingAddress);
        return res
          .status(400)
          .json({ success: false, error: "Incomplete shippingAddress" });
      }

      // Load product and verify seller
      const product = await Product.findById(productId).populate("user");
      if (!product) {
        console.error("Product not found:", productId);
        return res
          .status(404)
          .json({ success: false, error: "Product not found" });
      }

      // Check stock availability
      if (product.quantity < numericQuantity) {
        console.error("Insufficient stock:", {
          requested: numericQuantity,
          available: product.quantity,
        });
        return res.status(400).json({
          success: false,
          error: `Only ${product.quantity} items available. You requested ${numericQuantity}.`,
        });
      }

      // Prevent seller from buying their own product
      if (userId.toString() === product.user._id.toString()) {
        console.error("Seller cannot buy their own product");
        return res.status(400).json({
          success: false,
          error: "You cannot purchase your own product",
        });
      }

      const resolvedSeller = sellerId || product.user?._id;
      if (!resolvedSeller) {
        console.error("Seller not resolved for product");
        return res
          .status(400)
          .json({ success: false, error: "Seller not resolved for product" });
      }

      const normalizedAddress = {
        fullName: shippingAddress.fullName,
        phoneNumber: shippingAddress.phoneNumber,
        street1: shippingAddress.street1 || shippingAddress.streetAddress,
        street2: shippingAddress.street2 || "",
        city: shippingAddress.city,
        state: shippingAddress.state || "",
        country: shippingAddress.country,
        zipCode: shippingAddress.zipCode || shippingAddress.zip,
      };

      // Start a transaction to ensure both order creation and stock update succeed
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Generate unique transaction ID using unified format
        const {
          generateTransactionId,
        } = require("../../../../utils/transactionUtils");
        const transactionId = generateTransactionId("TXN");

        // Create the order
        const order = await Order.create(
          [
            {
              buyer: userId,
              seller: resolvedSeller,
              product: product._id,
              totalAmount: numericTotalAmount,
              orderDetails: {
                productPrice: product.price || numericTotalAmount,
                quantity: numericQuantity,
                currency: "USD",
              },
              payment: {
                method: "Cash on Delivery",
                status: "Pending",
                transactionId: transactionId,
              },
              status: "Pending",
              shipping: { toAddress: normalizedAddress },
            },
          ],
          { session }
        );

        // Update product stock
        const updatedProduct = await Product.findByIdAndUpdate(
          product._id,
          {
            $inc: { quantity: -numericQuantity },
            $set: {
              status:
                product.quantity - numericQuantity <= 0
                  ? "out_of_stock"
                  : "active",
            },
          },
          { new: true, session }
        );

        await session.commitTransaction();

        // ✅ Send notification to seller
        try {
          await NotificationService.notifyOrderPlaced(order[0]);
        } catch (notifError) {
          console.error("Notification sending error:", notifError);
        }

        // Emit realtime event to seller/admin listeners
        try {
          const { getIO } = require("../../../../utils/socket");
          const io = getIO && getIO();
          if (io) {
            const orderPayload = {
              id: order[0]._id,
              product: {
                id: product._id,
                title: product.title,
                price: product.price,
              },
              buyer: userId,
              seller: resolvedSeller,
              totalAmount: numericTotalAmount,
              createdAt: order[0].createdAt,
            };
            // Broadcast generic event and targeted event for seller
            io.emit("newOrder", orderPayload);
            io.to(`user_${resolvedSeller}`).emit("newOrder", orderPayload);
          }
        } catch (ioErr) {
          console.warn(
            "⚠️ Socket emit newOrder failed:",
            ioErr?.message || ioErr
          );
        }

        return res.status(200).json({
          success: true,
          data: order[0],
          stockUpdate: {
            remainingQuantity: updatedProduct.quantity,
            status: updatedProduct.status,
          },
        });
      } catch (transactionError) {
        await session.abortTransaction();
        throw transactionError;
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error("❌ Create COD order error:", error);
      console.error("Error stack:", error.stack);
      return res
        .status(500)
        .json({
          success: false,
          error: error.message || "Failed to create COD order",
        });
    }
  }

  async getUserOrders(req, res) {
    try {
      const userId = req.user._id;
      const { role = "buyer", status, page = 1, limit = 10 } = req.query;

      const query = {};
      if (role === "buyer") query.buyer = userId;
      else if (role === "seller") query.seller = userId;
      else query.$or = [{ buyer: userId }, { seller: userId }];

      if (status) {
        // allow filtering by either new COD orderStatus or legacy status
        query.$or = query.$or || [];
        query.$or.push({ orderStatus: status }, { status: status });
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const limitNum = parseInt(limit);

      const [orders, total] = await Promise.all([
        Order.find(query)
          .populate(
            "product",
            "title price product_photos brand size condition material colors user"
          )
          .populate("buyer", "userName profile email")
          .populate("seller", "userName profile email")
          .populate("escrowPayment")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        Order.countDocuments(query),
      ]);

      // Update orders that don't have transactionId (using updateOne to avoid validation errors)
      const {
        generateTransactionId,
      } = require("../../../../utils/transactionUtils");
      for (const order of orders) {
        if (order && !order.payment?.transactionId) {
          const transactionId = generateTransactionId("TXN");
          // Use updateOne to only update the transactionId field without triggering full validation
          await Order.updateOne(
            { _id: order._id },
            { $set: { "payment.transactionId": transactionId } }
          );
          // Update the in-memory object so the response includes the transactionId
          order.payment = order.payment || {};
          order.payment.transactionId = transactionId;
        }
      }

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limitNum),
            totalOrders: total,
            hasNext: skip + orders.length < total,
            hasPrev: parseInt(page) > 1,
          },
        },
      });
    } catch (error) {
      console.error("❌ Get user orders error:", error);
      res
        .status(500)
        .json({
          success: false,
          error: "Failed to fetch orders",
          details: error.message,
        });
    }
  }

  async getOrderDetails(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user._id;

      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid order ID" });
      }

      const order = await Order.findOne({
        _id: orderId,
        $or: [{ buyer: userId }, { seller: userId }],
      })
        .populate(
          "product",
          "title price product_photos brand size condition material colors user"
        )
        .populate("buyer", "userName profile email firstName lastName")
        .populate("seller", "userName profile email firstName lastName");

      if (!order) {
        return res
          .status(404)
          .json({ success: false, error: "Order not found" });
      }

      // If order doesn't have transactionId, add it (using updateOne to avoid validation errors)
      if (order && !order.payment?.transactionId) {
        const {
          generateTransactionId,
        } = require("../../../../utils/transactionUtils");
        const transactionId = generateTransactionId("TXN");

        // Use updateOne to only update the transactionId field without triggering full validation
        await Order.updateOne(
          { _id: order._id },
          { $set: { "payment.transactionId": transactionId } }
        );

        // Reload order to get updated data
        order = await Order.findById(orderId)
          .populate(
            "product",
            "title price product_photos brand size condition material colors user"
          )
          .populate("buyer", "userName profile email firstName lastName phone")
          .populate("seller", "userName profile email firstName lastName phone")
          .populate("escrowPayment");
      }

      // Check if user is authorized to view this order (must be buyer or seller)
      const isBuyer = order.buyer?._id?.toString() === userId.toString();
      const isSeller = order.seller?._id?.toString() === userId.toString();

      if (!isBuyer && !isSeller) {
        return res
          .status(403)
          .json({
            success: false,
            error: "You do not have permission to view this order",
          });
      }

      res.json({
        success: true,
        data: order,
      });
    } catch (error) {
      console.error("❌ Get order details error:", error);
      res
        .status(500)
        .json({
          success: false,
          error: "Failed to fetch order details",
          details: error.message,
        });
    }
  }

  async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const userId = req.user._id;

      const order = await Order.findById(id);
      if (!order) {
        return res
          .status(404)
          .json({ success: false, error: "Order not found" });
      }

      // Check if user is the seller
      if (order.seller.toString() !== userId.toString()) {
        return res
          .status(403)
          .json({
            success: false,
            error: "Only seller can update order status",
          });
      }

      // Update order status
      const updatedOrder = await Order.findByIdAndUpdate(
        id,
        {
          orderStatus: status,
          $push: {
            timeline: {
              status: status,
              timestamp: new Date(),
              description: notes || `Order status updated to ${status}`,
              updatedBy: "seller",
            },
          },
        },
        { new: true }
      ).populate("product buyer seller");

      res.json({
        success: true,
        data: updatedOrder,
        message: "Order status updated successfully",
      });
    } catch (error) {
      console.error("❌ Update order status error:", error);
      res
        .status(500)
        .json({
          success: false,
          error: "Failed to update order status",
          details: error.message,
        });
    }
  }

  async confirmDelivery(req, res) {
    try {
      const { orderId } = req.params;
      const { rating, feedback } = req.body;
      const userId = req.user._id;

      const order = await Order.findById(orderId);
      if (!order) {
        return res
          .status(404)
          .json({ success: false, error: "Order not found" });
      }

      // Check if user is the buyer
      if (order.buyer.toString() !== userId.toString()) {
        return res
          .status(403)
          .json({ success: false, error: "Only buyer can confirm delivery" });
      }

      // Update order status to delivered
      // Update both status and orderStatus fields for consistency
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        {
          status: "Delivered",
          orderStatus: "Delivered",
          // Update payment status for COD orders
          ...(order.paymentMethod === "Cash on Delivery" && {
            paymentStatus: "Paid",
            "payment.status": "Paid",
          }),
          "delivery.confirmedBy": "buyer",
          "delivery.confirmationDate": new Date(),
          "delivery.rating.deliveryRating": rating,
          "delivery.rating.feedback": feedback,
          "delivery.rating.ratedAt": new Date(),
          $push: {
            timeline: {
              status: "Delivered",
              timestamp: new Date(),
              description: "Order delivered and confirmed by buyer",
              updatedBy: "buyer",
            },
          },
        },
        { new: true }
      ).populate("product buyer seller");

      // Update wallet for seller when delivery is confirmed
      if (updatedOrder && updatedOrder.seller) {
        const walletController = require("../../wallet/controllers/walletController");
        await walletController.updateWalletOnDelivery(
          orderId,
          updatedOrder.seller._id,
          updatedOrder.totalAmount ||
            updatedOrder.orderDetails?.productPrice ||
            0
        );
      }

      // Send delivery confirmation emails to buyer and seller
      try {
        const deliveryDetails = {
          deliveryDate: updatedOrder.delivery?.confirmationDate || new Date(),
          rating: rating || updatedOrder.delivery?.rating?.deliveryRating,
          feedback: feedback || updatedOrder.delivery?.rating?.feedback,
          orderValue: updatedOrder.totalAmount || updatedOrder.orderDetails?.productPrice || 0
        };

        await OrderEmailService.sendDeliveryConfirmationEmails(
          updatedOrder,
          updatedOrder.buyer,
          updatedOrder.seller,
          updatedOrder.product,
          deliveryDetails
        );
      } catch (emailError) {
        console.error('Error sending delivery confirmation emails:', emailError);
        // Don't fail the request if email fails
      }

      res.json({
        success: true,
        data: updatedOrder,
        message: "Delivery confirmed successfully",
      });
    } catch (error) {
      console.error("❌ Confirm delivery error:", error);
      res
        .status(500)
        .json({
          success: false,
          error: "Failed to confirm delivery",
          details: error.message,
        });
    }
  }

  async getOrderStatistics(req, res) {
    try {
      const userId = req.user._id;
      const { role = "all" } = req.query;

      let matchQuery = {};
      if (role === "buyer") {
        matchQuery.buyer = userId;
      } else if (role === "seller") {
        matchQuery.seller = userId;
      } else {
        matchQuery.$or = [{ buyer: userId }, { seller: userId }];
      }

      const stats = await Order.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: "$orderStatus",
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalAmount" },
          },
        },
      ]);

      const totalOrders = await Order.countDocuments(matchQuery);
      const totalAmount = await Order.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]);

      res.json({
        success: true,
        data: {
          totalOrders,
          totalAmount: totalAmount[0]?.total || 0,
          statusBreakdown: stats,
        },
      });
    } catch (error) {
      console.error("❌ Get order statistics error:", error);
      res
        .status(500)
        .json({
          success: false,
          error: "Failed to fetch order statistics",
          details: error.message,
        });
    }
  }
}

module.exports = new OrderController();
