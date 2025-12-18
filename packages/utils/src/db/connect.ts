import mongoose from 'mongoose';
import process from 'process';

// 连接MongoDB数据库
export const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI environment variable is not defined');
  }
  await mongoose.connect(uri);
};
