import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function testModel() {
    const textModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    let count = 0;
    try {
        const promises = Array.from({ length: 20 }).map(async (_, i) => {
            const aiResult = await textModel.generateContent("hello short reply");
            count++;
            console.log("Success", i);
        });
        await Promise.all(promises);
        console.log("All 20 succeeded! No 15 RPM limit!");
    } catch (e) {
        console.error("Failed after", count, "requests:", e.message);
    }
}
testModel();
