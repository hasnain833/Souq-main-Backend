const Personalization = require("../../../../db/models/Personalization");
const Product = require("../../../../db/models/productModel");
const { createPersonalizationDto } = require("../personalizationDto/personalizationDto");

exports.getPersonalization = async (req, res) => {
    console.log(req.user, "reqid5454545")

    try {
        const userId = req.user._id;
        console.log(userId, "userId")

        if (!userId) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        const personalization = await Personalization.findOne({ user: userId })
            .populate("followedCategories");

        if (!personalization) {
            return res.status(200).json({ categories: [], brands: [] });
        }

        res.status(200).json(createPersonalizationDto(personalization));
    } catch (err) {
        res.status(500).json({
            message: "Error fetching personalization",
            error: err.message,
        });
    }
};

exports.saveOrUpdatePersonalization = async (req, res) => {
    try {
        const { categories = [], brands = [] } = req.body;

        const personalization = await Personalization.findOneAndUpdate(
            { user: req.user._id },
            {
                followedCategories: categories,
                followedBrands: brands,
            },
            { new: true, upsert: true }
        ).populate("followedCategories");

        res.status(200).json(createPersonalizationDto(personalization));
    } catch (err) {
        res.status(500).json({
            message: "Error saving personalization",
            error: err.message,
        });
    }
};

exports.addPersonalizationFromLikedProduct = async (req, res) => {
    try {
        const { productId } = req.body;

        const product = await Product.findById(productId).populate("category");
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const updateData = {
            $addToSet: {
                likedProducts: product._id,
            },
        };

        if (product.category?._id) {
            updateData.$addToSet.followedCategories = product.category._id;
        }

        if (product.brand) {
            updateData.$addToSet.followedBrands = product.brand;
        }

        const personalization = await Personalization.findOneAndUpdate(
            { user: req.user._id },
            updateData,
            { new: true, upsert: true }
        ).populate("followedCategories");

        res.status(200).json(createPersonalizationDto(personalization));
    } catch (err) {
        res.status(500).json({
            message: "Error updating personalization",
            error: err.message,
        });
    }
};

