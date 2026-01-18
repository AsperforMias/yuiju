import { ActionId, type ActionMetadata, allTrue, MajorScene } from "@yuiju/utils";
import { logger } from "@/utils/logger";

type ShopProduct = {
  name: string;
  price: number;
  stamina: number;
  description: string;
};

const SHOP_PRODUCTS: ShopProduct[] = [
  {
    name: "百奇",
    price: 100,
    stamina: 10,
    description: "涂层饼干棒，草莓口味。",
  },
  {
    name: "纯软糖",
    price: 50,
    stamina: 5,
    description: "高果汁含量的软糖，芒果口味。",
  },
  {
    name: "弹珠汽水糖",
    price: 30,
    stamina: 3,
    description: "汽水风味的硬糖，含气泡口感。",
  },
  {
    name: "抹茶布丁",
    price: 50,
    stamina: 5,
    description: "带有抹茶的清香微苦，口感细腻。",
  },
];

const SHOP_MIN_PRICE = Math.min(...SHOP_PRODUCTS.map((p) => p.price));

function isAtShop(major: MajorScene) {
  return major === MajorScene.Shop;
}

function formatProductDescription(product: ShopProduct) {
  return `${product.price}元，恢复${product.stamina}体力；${product.description}`;
}

export const shopAction: ActionMetadata[] = [
  {
    action: ActionId.Buy_Item_At_Shop,
    description: "在商店购买零食并放入背包，一次只能购买一件商品",
    precondition(context) {
      return allTrue([
        () => isAtShop(context.characterState.location.major),
        () => context.characterState.money >= SHOP_MIN_PRICE,
      ]);
    },
    parameterResolver: async (_context) => {
      return SHOP_PRODUCTS.map((product) => {
        return {
          value: product.name,
          description: formatProductDescription(product),
        };
      });
    },
    /**
     * parameters 的 length 为 1
     */
    async executor(context, parameters) {
      if (!parameters || parameters.length === 0) {
        logger.error("[Buy_Item_At_Shop] 没有选择商品");
        return "购买失败，没有选择商品。";
      }

      await context.characterState.setAction(ActionId.Buy_Item_At_Shop);

      let remainingMoney = context.characterState.money;

      // parameters 的 length 为 1
      const [selectedParameter] = parameters;

      const product = SHOP_PRODUCTS.find((p) => p.name === selectedParameter.value);
      if (!product) {
        logger.error(`[Buy_Item_At_Shop] 未找到商品: ${selectedParameter.value}`);
        return "购买失败，未找到商品。";
      }

      const desiredQuantity = selectedParameter.quantity ?? 1;
      const maxAffordable = Math.floor(remainingMoney / product.price);
      if (maxAffordable <= 0) {
        logger.info(
          `[Buy_Item_At_Shop] 余额不足，跳过购买: ${product.name}（单价${product.price}元，余额${remainingMoney}元）`,
        );
        return "购买失败，余额不足。";
      }

      const quantity = Math.min(Math.max(1, desiredQuantity), maxAffordable);
      if (quantity !== desiredQuantity) {
        logger.info(
          `[Buy_Item_At_Shop] 购买数量已裁剪: ${product.name} ${desiredQuantity} -> ${quantity}（余额${remainingMoney}元）`,
        );
      }

      const cost = product.price * quantity;
      await context.characterState.changeMoney(-cost);
      remainingMoney -= cost;

      await context.characterState.addItem(
        {
          name: product.name,
          description: product.description,
          category: "food",
          metadata: { stamina: product.stamina },
        },
        quantity,
      );

      logger.info(
        `[Buy_Item_At_Shop] 购买成功: ${product.name} x${quantity}，花费${cost}元，剩余${remainingMoney}元`,
      );
    },
    durationMin: 10,
  },
  {
    action: ActionId.Go_Home_From_Shop,
    description: "从商店回家。消耗体力5点。耗时20分钟。",
    precondition(context) {
      return isAtShop(context.characterState.location.major);
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Go_Home_From_Shop);
      await context.characterState.setLocation({ major: MajorScene.Home });
      await context.characterState.changeStamina(-5);
    },
    durationMin: 20,
  },
  {
    action: ActionId.Go_To_School_From_Shop,
    description: "从商店前往学校。消耗体力5点。耗时10分钟。",
    precondition(context) {
      return isAtShop(context.characterState.location.major);
    },
    async executor(context) {
      await context.characterState.setAction(ActionId.Go_To_School_From_Shop);
      await context.characterState.setLocation({ major: MajorScene.School });
      await context.characterState.changeStamina(-5);
    },
    durationMin: 10,
  },
];
