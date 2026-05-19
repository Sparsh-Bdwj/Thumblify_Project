import Thumbnail from "../models/Thumbnail.js";
import replicate from "../configs/replicate.js";
import { v2 as cloudinary } from "cloudinary";
import stream from "stream";
import { promisify } from "util";
const stylePrompts = {
    "Bold & Graphic": "eye-catching thumbnail, bold typography, vibrant colors, expressive facial reaction, dramatic lighting, high contrast, click-worthy composition, professional style",
    "Tech/Futuristic": "futuristic thumbnail, sleek modern design, digital UI elements, glowing accents, holographic effects, cyber-tech aesthetic, sharp lighting, high-tech atmosphere",
    Minimalist: "minimalist thumbnail, clean layout, simple shapes, limited color palette, plenty of negative space, modern flat design, clear focal point",
    Photorealistic: "photorealistic thumbnail, ultra-realistic lighting, natural skin tones, candid moment, DSLR-style photography, lifestyle realism, shallow depth of field",
    Illustrated: "illustrated thumbnail, custom digital illustration, stylized characters, bold outlines, vibrant colors, creative cartoon or vector art style",
};
const colorSchemeDescriptions = {
    vibrant: "vibrant and energetic colors, high saturation, bold contrasts, eye-catching palette",
    sunset: "warm sunset tones, orange pink and purple hues, soft gradients, cinematic glow",
    forest: "natural green tones, earthy colors, calm and organic palette, fresh atmosphere",
    neon: "neon glow effects, electric blues and pinks, cyberpunk lighting, high contrast glow",
    purple: "purple-dominant color palette, magenta and violet tones, modern and stylish mood",
    monochrome: "black and white color scheme, high contrast, dramatic lighting, timeless aesthetic",
    ocean: "cool blue and teal tones, aquatic color palette, fresh and clean atmosphere",
    pastel: "soft pastel colors, low saturation, gentle tones, calm and friendly aesthetic",
};
export const generateThumbnail = async (req, res) => {
    try {
        const { userId } = req.session;
        const { title, prompt: user_prompt, style, aspect_ratio, color_scheme, text_overlay, } = req.body;
        // 1. Create DB entry
        const thumbnail = await Thumbnail.create({
            userId,
            title,
            prompt_used: user_prompt,
            user_prompt,
            style,
            aspect_ratio,
            color_scheme,
            text_overlay,
            isGenerating: true,
        });
        // 2. Build prompt
        let prompt = `Create a ${stylePrompts[style]} for: "${title}"`;
        if (color_scheme) {
            prompt += ` Use a ${colorSchemeDescriptions[color_scheme]} color scheme.`;
        }
        if (user_prompt) {
            prompt += ` Additional details: ${user_prompt}.`;
        }
        prompt += ` The thumbnail should be ${aspect_ratio}, visually stunning, and designed to maximize click-through rate.`;
        // 3. Generate image (Replicate)
        const output = await replicate.run("black-forest-labs/flux-2-pro", {
            input: {
                prompt: prompt,
                aspect_ratio: aspect_ratio,
                output_format: "jpg",
            },
        });
        const pipeline = promisify(stream.pipeline);
        // Debug
        console.log("Replicate output:", output);
        // Convert stream → buffer
        const chunks = [];
        for await (const chunk of output) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        // Upload buffer to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream({ resource_type: "image" }, (error, result) => {
                if (error)
                    reject(error);
                else
                    resolve(result);
            });
            uploadStream.end(buffer);
        });
        const imageUrl = uploadResult.secure_url;
        if (!imageUrl) {
            throw new Error("Cloudinary upload failed");
        }
        // 5. Save result
        thumbnail.image_url = uploadResult.secure_url;
        thumbnail.isGenerating = false;
        await thumbnail.save();
        res.json({
            message: "Thumbnail Generated",
            thumbnail,
        });
    }
    catch (error) {
        console.log(error.message);
        res.status(500).json({
            message: error.message,
        });
    }
};
// Delete Thumbnail
export const deleteThumbnail = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.session;
        await Thumbnail.findByIdAndDelete({
            _id: id,
            userId,
        });
        res.json({
            message: "Thumbnail deleted successfully",
        });
    }
    catch (error) {
        console.log(error.message);
        res.status(500).json({
            message: error.message,
        });
    }
};
