import { generateObject } from 'ai';
import 'dotenv/config';
import { z } from 'zod';
import { deepseek } from '@ai-sdk/deepseek';

async function demo() {
  const res = await generateObject({
    model: deepseek('deepseek-chat'),
    schema: z.object({
      message: z.string(),
      count: z.number(),
    }),
    prompt: `生成一个 JSON 对象，包含以下字段：
- message: 一个问候语字符串。
- count: 一个表示问候次数的数字。

请确保返回的内容是一个有效的 JSON 对象。`,
  });

  console.log(res);
}

demo();
