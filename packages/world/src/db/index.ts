import mongoose from 'mongoose';
import process from 'process';

// 连接MongoDB数据库
export const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI!);
};
