import connectDB from "../../db/connection";
import Employee from "../../db/models/Employee";

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).end();
  }

  await connectDB().catch((err) => {
    console.log(err);
  });

  try {
    // Update entries for all employees to 1
    await Employee.updateMany({}, { $set: { entries: 1 } });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error resetting entries:', error);
    return res.status(500).json({ success: false });
  }
}