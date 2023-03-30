import connectDB from "../../db/connection";
import Raffle from "../../db/models/Raffle";

export default async function raffleHandler(req, res) {
  await connectDB().catch((err) => {
    console.log(err);
  });

  const { method } = req;
  switch (method) {
    case "GET":
      try {
        const raffle = await Raffle.find();
        res.status(200).json({ success: true, data: raffle });
      } catch (error) {
        res.status(400).json({ success: false });
      }
      break;
    case "POST":
      try {
        const raffle = await Raffle.create(req.body);
        res.status(201).json({ success: true, data: raffle });
      } catch (error) {
        res.status(400).json({ success: false });
      }
      break;

    default:
      res.setHeader("Allow", ["GET", "POST", "PUT"]);
      res.status(400).json({ success: false });
      break;
  }
}