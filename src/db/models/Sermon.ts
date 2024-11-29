import { Document, Model, model, Schema, Types } from "mongoose";

// Define the interface for a Sermon document

// Create the schema
const sermonSchema = new Schema({
  title: { type: String, required: true },
  subtitle: String,
  publishedAt: { type: Date, required: true, index: true },
  audioUrl: { type: String, required: true },
  image: String,
  videoId: { type: String, unique: true, required: true },
  transcription: String,
  transcribedAt: Date,
  summary: String,
  speaker: String,
  embeddedAt: { type: Date, index: true, sparse: true },
  questions: String,
  theme: String,
  book: String,
});

// Export the model and its type
const Sermon = model("SermonData", sermonSchema);
export default Sermon;
