"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../home.module.css";

type HomeMapCardProps = {
  location?: string;
};

type MapNode = {
  name: string;
  left: string;
  top: string;
  tag: string;
  desc: string;
  detail: string;
  actions: string[];
};

const mapNodes: MapNode[] = [
  {
    name: "家",
    left: "22%",
    top: "62%",
    tag: "当前",
    desc: "安全感拉满的休息点",
    detail: "可恢复体力、整理背包、制定计划。",
    actions: ["休息", "整理", "计划"],
  },
  {
    name: "学校",
    left: "55%",
    top: "48%",
    tag: "可前往",
    desc: "学习与成长的主要场景",
    detail: "适合安排课程、刷题与专项训练。",
    actions: ["上课", "自习", "社团活动"],
  },
  {
    name: "商店",
    left: "78%",
    top: "68%",
    tag: "可前往",
    desc: "补给与偶尔的放松",
    detail: "可以购买补给，顺便看看新品。",
    actions: ["购物", "补给", "逛逛"],
  },
];

export function HomeMapCard({ location }: HomeMapCardProps) {
  const currentLocation = location ?? "家";
  const [selectedName, setSelectedName] = useState(currentLocation);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    if (!mapNodes.some((node) => node.name === selectedName)) {
      setSelectedName(currentLocation);
    }
  }, [currentLocation, selectedName]);

  useEffect(() => {
    if (!isZoomOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsZoomOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZoomOpen]);

  useEffect(() => {
    if (!isDetailOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDetailOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDetailOpen]);

  const selectedNode = useMemo(() => {
    return (
      mapNodes.find((node) => node.name === selectedName) ??
      mapNodes.find((node) => node.name === currentLocation) ??
      mapNodes[0]
    );
  }, [currentLocation, selectedName]);

  const mapStage = (variant: "default" | "zoom") => (
    <section
      className={`${styles["home-rpg-map"]} ${
        variant === "zoom" ? styles["home-rpg-map-zoom"] : ""
      }`}
      aria-label="二维地图"
    >
      <svg className={styles["home-map-edges"]} viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="22" y1="62" x2="55" y2="48" />
        <line x1="55" y1="48" x2="78" y2="68" />
        <line x1="22" y1="62" x2="78" y2="68" />
      </svg>

      {mapNodes.map((node) => {
        const isActive = node.name === currentLocation;
        const isSelected = node.name === selectedNode?.name;
        return (
          <div
            key={node.name}
            className={`${styles["home-map-node"]} ${
              isActive ? styles["home-map-node-active"] : ""
            } ${isSelected ? styles["home-map-node-selected"] : ""}`}
            style={{ left: node.left, top: node.top }}
          >
            <button
              className={styles["home-node-card"]}
              type="button"
              onClick={() => {
                setSelectedName(node.name);
                setIsDetailOpen(true);
              }}
              aria-pressed={isSelected}
              aria-haspopup="dialog"
            >
              <span className={styles["home-node-name"]}>{node.name}</span>
              <span className={styles["home-node-tag"]}>
                {isActive ? "当前" : node.tag}
              </span>
            </button>
          </div>
        );
      })}
    </section>
  );

  return (
    <section className={styles["home-card"]}>
      <div className={styles["home-map-shell"]}>
        <div className={styles["home-map-head"]}>
          <h3 className={styles["home-card-title"]}>世界地图（RPG 示意）</h3>
          <div className={styles["home-map-tools"]}>
            <span className={styles["home-pill"]}>
              <span className={styles["home-muted"]}>当前位置</span>&nbsp;
              <strong>{currentLocation}</strong>
            </span>
            <button
              className={`${styles["home-btn"]} ${styles["home-btn-icon"]}`}
              type="button"
              aria-label="放大地图"
              onClick={() => setIsZoomOpen(true)}
            >
              <svg
                className={styles["home-icon"]}
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 5H6a1 1 0 0 0-1 1v3M15 5h3a1 1 0 0 1 1 1v3M9 19H6a1 1 0 0 1-1-1v-3M15 19h3a1 1 0 0 0 1-1v-3"
                  stroke="rgba(43,47,54,0.9)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className={styles["home-map"]}>
          {mapStage("default")}
        </div>
      </div>

      {isZoomOpen ? (
        <div
          className={styles["home-map-overlay"]}
          onClick={() => setIsZoomOpen(false)}
          role="presentation"
        >
          <section
            className={styles["home-map-zoom"]}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="放大地图"
          >
            <header className={styles["home-map-zoom-head"]}>
              <div>
                <h3 className={styles["home-map-zoom-title"]}>世界地图 · 放大查看</h3>
                <p className={styles["home-map-zoom-subtitle"]}>点击节点查看详情</p>
              </div>
              <button
                className={`${styles["home-btn"]} ${styles["home-btn-secondary"]}`}
                type="button"
                onClick={() => setIsZoomOpen(false)}
              >
                关闭
              </button>
            </header>
            <div className={styles["home-map-zoom-body"]}>
              {mapStage("zoom")}
            </div>
          </section>
        </div>
      ) : null}

      {isDetailOpen && selectedNode ? (
        <div
          className={styles["home-map-detail-overlay"]}
          onClick={() => setIsDetailOpen(false)}
          role="presentation"
        >
          <section
            className={styles["home-map-detail-modal"]}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedNode.name}地点详情`}
          >
            <header className={styles["home-map-detail-modal-head"]}>
              <div>
                <h4 className={styles["home-map-detail-title"]}>{selectedNode.name}</h4>
                <p className={styles["home-map-detail-subtitle"]}>RPG 地图 · 地点详情（Mock）</p>
              </div>
              <button
                className={styles["home-map-detail-close"]}
                type="button"
                onClick={() => setIsDetailOpen(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </header>
            <div className={styles["home-map-detail-body"]}>
              <p className={styles["home-map-detail-desc"]}>{selectedNode.detail}</p>
              <p className={styles["home-map-detail-note"]}>{selectedNode.desc}</p>
              <div className={styles["home-chips"]}>
                {selectedNode.actions.map((action) => (
                  <span key={action} className={styles["home-chip"]}>
                    {action}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
