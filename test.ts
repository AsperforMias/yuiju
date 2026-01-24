import { Memory } from "mem0ai/oss";
import "dotenv/config";

const memory = new Memory({
  version: "v1.1",
  enableGraph: true,
  graphStore: {
    provider: "neo4j",
    llm: {
      provider: "openai",
      config: {
        apiKey: process.env.SILICONFLOW_API_KEY || "",
        model: "Qwen/Qwen3-8B",
        url: "https://api.siliconflow.cn/v1",
      },
    },
    config: {
      url: "bolt://192.168.31.10:7687",
      username: "neo4j",
      password: "neo4j123456",
    },
  },
  llm: {
    provider: "openai",
    config: {
      apiKey: process.env.SILICONFLOW_API_KEY || "",
      model: "Qwen/Qwen3-8B",
      baseURL: "https://api.siliconflow.cn/v1",
    },
  },
  embedder: {
    provider: "openai",
    config: {
      apiKey: process.env.SILICONFLOW_API_KEY || "",
      model: "Qwen/Qwen3-Embedding-4B",
      url: "https://api.siliconflow.cn/v1",
      
    },
  },
  vectorStore: {
    provider: "qdrant",
    config: {
      collectionName: "memories",
      dimension: 2560,
      host: "192.168.31.10",
      port: 6333,
    },
  },
  // historyDbPath: "memory.db",
  disableHistory: true,
});

async function main() {
  // const messages = [
  //   { role: "user", content: "I'm planning to watch a movie tonight. Any recommendations?" },
  //   { role: "assistant", content: "How about thriller movies? They can be quite engaging." },
  //   { role: "user", content: "I'm not a big fan of thriller movies but I love sci-fi movies." },
  //   {
  //     role: "assistant",
  //     content:
  //       "Got it! I'll avoid thriller recommendations and suggest sci-fi movies in the future.",
  //   },
  // ];

  // await memory.add(messages, { userId: "alice", metadata: { category: "movie_recommendations" } });

  const results = await memory.search("What do you know about me?", { userId: "alice" });
  console.log(results);
}

main();
