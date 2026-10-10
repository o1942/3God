import { useState, useEffect } from 'react';
import { useGame } from '../store/gameStore';

// 新手引导：4 步教学
// 每步对应一个游戏核心操作，完成后自动进入下一步
// 全部完成后写入 localStorage，不再显示

const TUTORIAL_KEY = 'travian-mvp-tutorial-done';

type Step = 0 | 1 | 2 | 3 | 4;

const STEPS = [
  {
    title: '资源田生产',
    icon: '🌳',
    desc: '点击下方的「资源田」标签，查看你的四块资源田。\n木材、陶土、铜矿、粟米是部落发展的根基。\n点击任意一块资源田卡片，然后点「升级」按钮。',
    hint: '升级资源田可以提升每小时产量',
  },
  {
    title: '建造建筑',
    icon: '🏗️',
    desc: '点击底部导航的「建造」按钮。\n选择一个建筑（建议先建「封禅台」），\n资源足够时点击「建造」。',
    hint: '封禅台等级越高，建造速度越快',
  },
  {
    title: '训练兵力',
    icon: '🏹',
    desc: '建造「军帐」后，点击底部导航的「军帐」按钮。\n选择兵种并训练，兵力是你出征和防御的核心力量。',
    hint: '不同兵种有不同攻防特性，合理搭配',
  },
  {
    title: '出征妖兽',
    icon: '🗺️',
    desc: '点击底部导航的「地图」按钮。\n在地图上选择一个妖兽据点，派兵出征。\n击败妖兽可以获得资源和赛季积分！',
    hint: '注意兵种克制关系，斥候先行',
  },
];

export function TutorialGuide() {
  const [step, setStep] = useState<Step>(0);
  const [visible, setVisible] = useState(false);
  const [skipped, setSkipped] = useState(false);

  // 检查是否已完成引导
  useEffect(() => {
    try {
      const done = localStorage.getItem(TUTORIAL_KEY);
      if (done) return; // 已完成，不显示
    } catch { /* ignore */ }

    // 延迟 1.5 秒显示，等部落选择/登录流程结束
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // 自动检测每步是否完成
  const village = useGame((s) => s.village);
  const battleReports = useGame((s) => s.battleReports);
  const marchQueue = useGame((s) => s.village.marchQueue);

  useEffect(() => {
    if (!visible || skipped) return;

    // Step 0 → 1: 有资源田升级中或已升级（Lv > 0 的田 > 初始数量）
    if (step === 0) {
      const totalFieldLv = Object.values(village.fields).flat().reduce((s, lv) => s + lv, 0);
      if (totalFieldLv > 0 || village.buildQueue.some(t => t.target.kind === 'field')) {
        setStep(1);
      }
    }

    // Step 1 → 2: 有建筑在建造中或已建造
    if (step === 1) {
      const builtCount = Object.values(village.buildings).filter(lv => (lv || 0) > 0).length;
      if (builtCount > 1 || village.buildQueue.some(t => t.target.kind === 'building')) {
        setStep(2);
      }
    }

    // Step 2 → 3: 有兵力或训练队列
    if (step === 2) {
      const totalUnits = Object.values(village.units).reduce((s, n) => s + (n || 0), 0);
      if (totalUnits > 0 || village.trainQueue.length > 0) {
        setStep(3);
      }
    }

    // Step 3 → 4: 有行军记录或战报
    if (step === 3) {
      const hasMarch = marchQueue.length > 0;
      const hasBattle = battleReports.length > 0;
      if (hasMarch || hasBattle) {
        completeTutorial();
      }
    }
  }, [visible, skipped, step, village, battleReports, marchQueue]);

  const completeTutorial = () => {
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  const handleSkip = () => {
    setSkipped(true);
    completeTutorial();
  };

  if (!visible || step >= 4) return null;

  const current = STEPS[step];

  return (
    <>
      {/* 半透明遮罩 + 高亮提示气泡 */}
      <div className="fixed inset-0 z-[150] pointer-events-none">
        {/* 引导气泡 */}
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-md pointer-events-auto">
          <div className="card-std border-2 border-pop rounded-2xl p-4 anim-slide-up shadow-xl" style={{ boxShadow: '0 4px 24px rgba(201,136,42,0.3)' }}>
            {/* 步骤指示器 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-pop' : i < step ? 'w-1.5 bg-pop/60' : 'w-1.5 bg-border'}`}
                  />
                ))}
              </div>
              <span className="text-[10px] text-text-muted">{step + 1}/4</span>
            </div>

            {/* 内容 */}
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl shrink-0">{current.icon}</span>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-pop mb-1">第 {step + 1} 步：{current.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{current.desc}</p>
              </div>
            </div>

            {/* 提示 */}
            <div className="text-[10px] text-text-muted bg-bg-primary rounded-lg px-2 py-1.5 mb-3">
              💡 {current.hint}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleSkip}
                className="text-[10px] text-text-muted hover:text-text-secondary transition"
              >
                跳过引导
              </button>
              {step < 3 ? (
                <span className="text-[10px] text-text-muted flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 bg-pop rounded-full anim-pulse" />
                  完成后自动进入下一步
                </span>
              ) : (
                <button
                  onClick={completeTutorial}
                  className="text-[10px] text-pop font-semibold hover:text-pop-hover transition"
                >
                  完成引导 ✓
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 底部指向箭头 */}
        {step < 2 && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-pop text-2xl anim-pulse">
            ↑
          </div>
        )}
      </div>
    </>
  );
}

export default TutorialGuide;
