import connectDB from "../../../db/connection";
import Raffle from "../../../db/models/Raffle";

export default async function getRaffle(req, res) {
  await connectDB().catch((err) => {
    console.log(err);
  });

  const { method } = req;

  switch (method) {
    case "GET":
      try {
        const raffle = await Raffle.findById(req.query.id);
        res.status(200).json({ success: true, data: raffle });
      } catch (error) {
        res.status(400).json({ success: false });
      }
      break;
    case "DELETE":
      try {
        const deletedRaffle = await Raffle.deleteOne({ _id: req.query.id });
        if (!deletedRaffle) {
          return res.status(400).json({ success: false });
        }
        res.status(200).json({ success: true, data: {} });
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

