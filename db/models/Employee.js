// Create a model for the Employee collection

const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  email: {
    type: String,
  },
  imageURL: {
    type: String,
  },
  entries: {
    type: Number,
    default: 0
  },
});

module.exports = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);