declare const _exports: mongoose.Model<{
    type: "manual" | "tag_based";
    name: string;
    userId: mongoose.Types.ObjectId;
    tags: string[];
    leadIds: mongoose.Types.ObjectId[];
    lastSentIndex: number;
    campaignStatus: "completed" | "idle" | "sending" | "paused";
    campaignTemplate: string;
} & mongoose.DefaultTimestampProps, {}, {}, {}, mongoose.Document<unknown, {}, {
    type: "manual" | "tag_based";
    name: string;
    userId: mongoose.Types.ObjectId;
    tags: string[];
    leadIds: mongoose.Types.ObjectId[];
    lastSentIndex: number;
    campaignStatus: "completed" | "idle" | "sending" | "paused";
    campaignTemplate: string;
} & mongoose.DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    type: "manual" | "tag_based";
    name: string;
    userId: mongoose.Types.ObjectId;
    tags: string[];
    leadIds: mongoose.Types.ObjectId[];
    lastSentIndex: number;
    campaignStatus: "completed" | "idle" | "sending" | "paused";
    campaignTemplate: string;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    type: "manual" | "tag_based";
    name: string;
    userId: mongoose.Types.ObjectId;
    tags: string[];
    leadIds: mongoose.Types.ObjectId[];
    lastSentIndex: number;
    campaignStatus: "completed" | "idle" | "sending" | "paused";
    campaignTemplate: string;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    type: "manual" | "tag_based";
    name: string;
    userId: mongoose.Types.ObjectId;
    tags: string[];
    leadIds: mongoose.Types.ObjectId[];
    lastSentIndex: number;
    campaignStatus: "completed" | "idle" | "sending" | "paused";
    campaignTemplate: string;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    timestamps: true;
}>> & mongoose.FlatRecord<{
    type: "manual" | "tag_based";
    name: string;
    userId: mongoose.Types.ObjectId;
    tags: string[];
    leadIds: mongoose.Types.ObjectId[];
    lastSentIndex: number;
    campaignStatus: "completed" | "idle" | "sending" | "paused";
    campaignTemplate: string;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
export = _exports;
import mongoose = require("mongoose");
