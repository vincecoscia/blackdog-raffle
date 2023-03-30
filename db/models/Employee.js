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
  user: {
    type: String,
    required: true
  },
});

module.exports = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);