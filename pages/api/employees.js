import connectDB from "../../db/connection";
import Employee from "../../db/models/Employee";

export default async function employeeHandler (req, res) {

  await connectDB().catch((err) => {
    console.log(err);
  });

  const { method } = req;

  switch (method) {
    case "GET":
      try {
        const employees = await Employee.find();
        res.status(200).json({ success: true, data: employees });
      } catch (error) {
        res.status(400).json({ success: false });
      }
      break;
    case "POST":
      try {
        const employee = await Employee.create(req.body);
        res.status(201).json({ success: true, data: employee });
      } catch (error) {
        res.status(400).json({ success: false });
      }
      break;

    default:
      res.setHeader("Allow", ["GET", "POST", "PUT"]);
      res.status(400).json({ success: false });
      break;
  }
};