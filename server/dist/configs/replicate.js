import Replicate from "replicate";
import dotenv from "dotenv";
dotenv.config();
console.log("Replicate API Key:", process.env.REPLICATE_API_KEY);
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_KEY,
});
export default replicate;
