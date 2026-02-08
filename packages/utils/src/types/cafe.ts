/**
 * 咖啡店可点单/可消费的咖啡名称枚举。
 *
 * 说明：
 * - 枚举值使用“展示用中文名”，确保落到背包 item.name 的字符串稳定一致。
 * - 使用 enum 目的是让 world/web/message 等跨包代码对“可用名称集合”有强类型约束。
 */
export enum CafeCoffeeName {
  BlendHot = "拼配热咖啡",
  IcedCoffee = "冰咖啡",
  Americano = "美式咖啡",
  CafeAuLait = "咖啡欧蕾",
  Latte = "拿铁",
}

/**
 * 咖啡店咖啡配置（资源数据）。
 *
 * 说明：
 * - stamina/satiety/mood 均为“饮用时”的恢复值；
 * - name 必须来自 CafeCoffeeName，避免出现拼写不一致导致库存匹配失败。
 */
export type CafeCoffee = {
  name: CafeCoffeeName;
  price: number;
  description: string;
  /** 体力恢复值 */
  stamina?: number;
  /** 饱腹度恢复值 */
  satiety?: number;
  /** 心情恢复值 */
  mood?: number;
};

/**
 * 咖啡店商品清单（资源数据）。
 *
 * 说明：
 * - 该清单会被用于 LLM 的点单选择，以及背包消费逻辑；
 * - 修改这里会影响行为数值与测试断言，请同步更新相关单测。
 */
export const CAFE_COFFEES: CafeCoffee[] = [
  {
    name: CafeCoffeeName.BlendHot,
    price: 80,
    stamina: 5,
    satiety: 8,
    description: "店家每日拼配，香气温和，口感顺口。",
  },
  {
    name: CafeCoffeeName.IcedCoffee,
    price: 90,
    stamina: 5,
    satiety: 9,
    description: "冰镇清爽，适合夏天。",
  },
  {
    name: CafeCoffeeName.Americano,
    price: 90,
    stamina: 5,
    satiety: 9,
    description: "清透不腻，带一点点苦。",
  },
  {
    name: CafeCoffeeName.CafeAuLait,
    price: 100,
    stamina: 5,
    satiety: 10,
    mood: 3,
    description: "牛奶与咖啡的温柔平衡。",
  },
  {
    name: CafeCoffeeName.Latte,
    price: 110,
    stamina: 5,
    satiety: 11,
    description: "奶泡细腻，口感更醇厚。",
  },
];
