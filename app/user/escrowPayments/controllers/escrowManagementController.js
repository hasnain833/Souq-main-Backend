// controllers/escrowManagementController.js
const EscrowPayment = require('../../../../db/models/EscrowPayment');
const Order = require('../../../../db/models/orderModel');
const mongoose = require('mongoose');

exports.initiateDispute = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Dispute handling is currently unavailable. Please contact Habibi ماركت support for assistance.'
  });
};

exports.getUserEscrows = async (req, res) => {
  try {
    // console.log("Fetching user escrows", req.user);
    const userId = req.user._id;
    console.log("User ID:", userId);
    const { role, status } = req.query;

    let query = {};
    if (role === 'buyer') {
      query.buyer = userId;
    } else if (role === 'seller') {
      query.seller = userId;
    } else {
      query.$or = [{ buyer: userId }, { seller: userId }];
    }

    if (status) {
      query.status = status;
    }

    const escrows = await EscrowPayment.find(query)
      .populate('buyer', 'name email')
      .populate('seller', 'name email')
      .populate('product', 'title images')
      .sort({ createdAt: -1 });

    res.json(escrows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getEscrowDetails = async (req, res) => {
  try {
    const { escrowId } = req.params;
    const userId = req.user._id; // Use _id (ObjectId) instead of id (UUID)

    const escrow = await EscrowPayment.findOne({
      _id: escrowId,
      $or: [{ buyer: userId }, { seller: userId }]
    })
    .populate('buyer', 'name email')
    .populate('seller', 'name email')
    .populate('product', 'title images description')
    .populate('disputeRaisedBy', 'name email');

    if (!escrow) {
      return res.status(404).json({ error: 'Escrow payment not found' });
    }

    res.json(escrow);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};