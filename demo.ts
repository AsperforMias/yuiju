import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

// Redis 连接配置
const connection = new IORedis({
  host: '192.168.31.10',
  port: 6379,
  maxRetriesPerRequest: null,
});

const QUEUE_NAME = 'queue-demo';

/**
 * 消费一次指定队列的消息
 * 该函数返回一个 Promise，当队列中的第一个任务被成功处理后 Resolve
 */
function consumeOnce(): Promise<any> {
  return new Promise((resolve, reject) => {
    console.log(`[Consumer] Waiting for event on '${QUEUE_NAME}'...`);

    // 创建 Worker 进行消费
    const worker = new Worker(
      QUEUE_NAME,
      async (job: Job) => {
        console.log(`[Consumer] Processing job ${job.id} (Name: ${job.name})`);
        return job.data; // 返回数据，后续在 completed 事件中可获取
      },
      { connection }
    );

    // 监听任务完成事件
    worker.on('completed', async (job, returnvalue) => {
      console.log(`[Consumer] Job ${job.id} completed.`);

      // 1. 任务完成，Resolve Promise
      resolve(job.data);

      // 2. 关键：关闭 Worker，停止消费后续消息，实现 "Once" 效果
      await worker.close();
      console.log('[Consumer] Worker closed (Once effect).');
    });

    // 监听失败事件
    worker.on('failed', async (job, err) => {
      console.error(`[Consumer] Job ${job?.id} failed:`, err);
      reject(err);
      await worker.close();
    });

    // 监听 Worker 错误
    worker.on('error', err => {
      console.error('[Consumer] Worker error:', err);
      reject(err);
      worker.close();
    });
  });
}

// --- 测试代码 ---

async function runDemo() {
  // 1. 启动异步消费者（它会等待消息）
  const consumePromise = consumeOnce();

  // 2. 模拟生产者：延迟 1 秒后发送消息
  setTimeout(async () => {
    const queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 10 },
    });
    console.log('[Producer] Adding job to queue...');
    await queue.add('test-event', {
      message: 'Hello, this is a one-time message!',
      timestamp: Date.now(),
    });
    await queue.close();
  }, 5000);

  // 3. 等待消费者 Resolve
  try {
    const result = await consumePromise;
    console.log('\n🎉 Consumed Result:', result);
  } catch (error) {
    console.error('Demo failed:', error);
  } finally {
    // 退出进程
    process.exit(0);
  }
}

runDemo();
