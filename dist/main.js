var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import fastify from "fastify";
import openai from "./lib/open-ai";
import multipart from "@fastify/multipart";
import cors from "@fastify/cors";
import fs from "node:fs";
import util from "util";
import { pipeline } from "stream";
import { v4 as uuidv4 } from "uuid";
const pump = util.promisify(pipeline);
const app = fastify({
    logger: true,
});
const start = () => __awaiter(void 0, void 0, void 0, function* () {
    yield app.register(multipart);
    yield app.register(cors, {
        origin: "*",
        methods: ["POST"],
    });
    app.post("/upload", (request, reply) => __awaiter(void 0, void 0, void 0, function* () {
        const file = yield request.file();
        if (!file)
            return reply.send("No file uploaded");
        const uuid = uuidv4();
        const fileName = `./uploads/${uuid}.${file.mimetype.split("/")[1]}`;
        yield pump(file.file, fs.createWriteStream(fileName));
        const base64_image = fs.readFileSync(fileName, "base64");
        fs.unlinkSync(fileName);
        const res = yield openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "assistant",
                    content: `You are an AI that recognizes images. You will receive an image of a plant. You need to answer the plant's name and a possible disease that it might have.
            You must answer in the following format: {
              "plant_name": string,
              "disease": string | null,
              "info":{
                "water_frequency": string (You must use the following values: "daily", "weekly", "monthly" and the frequency. EX: 1x daily),
                "light": string (full sun, partial sun, shade),
                "toxicity": boolean (true, false),
              },
              "confidence": number (0-1)
            }
            If there is no disease, you can leave the "disease" field if null.
            If your confidence is less than 0.8, you must retry and re-evaluate the image.
            `,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${file.mimetype};base64,${base64_image}`,
                            },
                        },
                    ],
                },
            ],
        });
        const text = res.choices[0].message.content;
        return text;
    }));
    try {
        yield app.listen({ port: 3000 });
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
});
start();
