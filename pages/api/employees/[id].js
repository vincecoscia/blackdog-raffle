import connectDB from "../../../db/connection";
import Employee from "../../../db/models/Employee";

export default async function getEmployee(req, res) {
  await connectDB().catch((err) => {
    console.log(err);
  });

  const { method } = req;

  switch (method) {
    case "GET":
      try {
        const employee = await Employee.findById(req.query.id);
        res.status(200).json({ success: true, data: employee });
      } catch (error) {
        res.status(400).json({ success: false });
      }
      break;
    case "PUT":
      try {
        const employee = await Employee.findByIdAndUpdate(
          req.query.id,
          req.body,
          {
            new: true,
            runValidators: true,
          }
        );
        if (!employee) {
          return res.status(400).json({ success: false });
        }
        res.status(200).json({ success: true, data: employee });
      } catch (error) {
        res.status(400).json({ success: false });
      }
      break;
    default:
      res.setHeader("Allow", ["GET", "PUT"]);
      res.status(400).json({ success: false });
      break;
  }
}
