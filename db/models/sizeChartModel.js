// // models/sizeChartModel.js
// const mongoose = require('mongoose');

// const sizeChartSchema = new mongoose.Schema({
//   childCategory: {
//     id: { 
//         type: mongoose.Schema.Types.ObjectId, ref: 'Category', 
//         required: true 
//     },
//     name: { 
//         type: String, 
//         required: true 
//     }
//   },
//   sizes: [{ 
//     type: String, 
//     required: true 
// }]
// }, { timestamps: true });

// module.exports = mongoose.model('SizeChart', sizeChartSchema);


const mongoose = require('mongoose');

const sizeChartSchema = new mongoose.Schema({
  childCategory: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Category',
    },
    slug: {
      type: String,
      required: true
    }
  },
  sizes: {
    type: [String],
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('SizeChart', sizeChartSchema);
