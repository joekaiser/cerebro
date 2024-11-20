import { Document, Model, model, Schema, Types } from "mongoose";

// Define the interface for a Sermon document
interface SermonModel {
  id?: Types.ObjectId; // Mongoose generates this automatically
  title: string;
  subtitle?: string;
  publishedAt: Date;
  audioUrl: string;
  image?: string;
  videoId: string;
  transcription?: string;
  transcribedAt?: Date;
  embeddedAt?: Date;
  summary?: string;
  speaker?: string;
}

// Extend Document to create the type for Mongoose documents
type SermonDocument = SermonModel & Document;

// Create the schema
const sermonSchema = new Schema({
  id: Types.ObjectId,
  title: { type: String, required: true },
  subtitle: String,
  publishedAt: { type: Date, required: true },
  audioUrl: { type: String, required: true },
  image: String,
  videoId: { type: String, unique: true, required: true },
  transcription: String,
  transcribedAt: Date,
  summary: String,
  speaker: String,
  embeddedAt: Date,
});

// Export the model and its type
const Sermon = model<SermonDocument>("SermonData", sermonSchema);
export default Sermon;
