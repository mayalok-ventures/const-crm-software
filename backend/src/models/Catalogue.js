const mongoose = require('mongoose');

/**
 * Catalogue Schema
 * Manages product, course, plan, and digital pass offerings.
 */
const catalogueSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    discountedPrice: {
      type: Number,
      default: null,
      min: [0, 'Discounted price cannot be negative'],
      validate: {
        validator: function (val) {
          return val === null || val === undefined || val <= this.price;
        },
        message: 'Discounted price cannot exceed base price',
      },
    },
    category: {
      type: String,
      default: 'GENERAL',
      trim: true,
      uppercase: true,
      index: true,
    },
    mediaUrls: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator user ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

catalogueSchema.index({ category: 1, isActive: 1, price: 1 });

module.exports = mongoose.models.Catalogue || mongoose.model('Catalogue', catalogueSchema);
