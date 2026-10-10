// 游戏核心类型定义

// 三大部落：炎帝（火德·农耕）、黄帝（土德·文明）、蚩尤（金德·勇武）
export type TribeType = 'yan' | 'huang' | 'chi';

// 兵种类型
export type UnitType = 'warrior' | 'archer' | 'cavalry' | 'guard';

// 阵型类型
export type FormationType = 'vanguard' | 'shield' | 'wings' | 'cone';

// 科技类型
export type TechType =
  | 'logging' | 'digging' | 'smelting' | 'farming'
  | 'strong_attack' | 'strong_defense' | 'drill' | 'forced_march'
  | 'granary' | 'architecture' | 'scouting';

// 研发任务
export type ResearchTask = {
  id: string;
  tech: TechType;
  level: number; // 要升到的等级（1-based）
  startAt: number;
  duration: number;
};

export type ResourceType = 'wood' | 'clay' | 'iron' | 'crop';

export type ResourceCost = {
  wood: number;
  clay: number;
  iron: number;
  crop: number;
};

// 资源田 4 种
export type FieldType = 'woodcutter' | 'clayPit' | 'ironMine' | 'cropland';

// 村内核心建筑
export type BuildingType =
  | 'mainBuilding'
  | 'warehouse'
  | 'granary'
  | 'rallyPoint'
  | 'cranny'
  | 'barracks'
  | 'embassy'
  | 'market'
  | 'smithy'
  | 'academy'
  | 'stable'
  | 'workshop'
  | 'wall';

export type FieldLevel = {
  level: number;
  cost: ResourceCost; // 升级到本级所需资源
  buildTime: number;  // 升级到本级所需秒数（标准速度）
  production: number; // 此等级每小时产量
};

export type FieldConfig = {
  type: FieldType;
  name: string;
  produces: ResourceType;
  colorClass: string; // tailwind 颜色类
  emoji: string;
  levels: FieldLevel[];
};

export type BuildingLevel = {
  level: number;
  cost: ResourceCost;
  buildTime: number;
  pop: number; // 占用人口
  effect: Partial<{
    capacity: number;        // 仓库容量
    cropCapacity: number;    // 粮仓容量
    buildSpeed: number;      // 建造速度加成（如 1.1 = +10%）
    hideAmount: number;      // 山洞隐藏量
    merchantCount: number;   // 市场商人数
    defense: number;         // 城墙防御值（吸收伤害）
    defenseBonus: number;    // 城墙守军防御加成（如 0.04 = +4%）
    deployLimit: number;     // 点将台单次出兵上限
  }>;
};

export type BuildingConfig = {
  type: BuildingType;
  name: string;
  description: string;
  emoji: string;
  maxLevel: number;
  prerequisites: { building: BuildingType; level: number }[];
  levels: BuildingLevel[];
};

// 建造任务
export type BuildTarget =
  | { kind: 'field'; fieldType: FieldType; index: number }
  | { kind: 'building'; building: BuildingType };

export type BuildTask = {
  id: string;
  target: BuildTarget;
  fromLevel: number;
  toLevel: number;
  cost: ResourceCost;
  startAt: number;   // ms timestamp
  duration: number;  // ms
};

// 赛季状态
export type SeasonState = {
  number: number;          // 赛季编号
  points: number;          // 当前积分
  startAt: number;         // 赛季开始 ms
  endsAt: number;           // 赛季结束 ms
  claimedMilestones: number[]; // 已领取的里程碑（积分档位）
};

// 护盾类型
export type ShieldType = 'newbie' | 'active';

// 护盾状态
export type ShieldState = {
  type: ShieldType;        // 护盾类型：新手/主动激活
  expiresAt: number;       // 护盾到期时间戳
  cooldownUntil: number;  // 主动护盾冷却到期时间（0=无冷却）
};

// 村庄完整状态
export type VillageState = {
  // 玩家名（登录时输入，作为存档 key）
  playerName: string;
  // 所属部落（炎帝/黄帝/蚩尤），影响兵种名与被动加成
  tribe: TribeType;
  resources: ResourceCost;
  fields: Record<FieldType, number[]>; // 长度 18 / 4 = 4 或 5
  buildings: Partial<Record<BuildingType, number>>;
  buildQueue: BuildTask[];
  // 训练队列
  trainQueue: TrainTask[];
  // 已训练士兵数量（多兵种）
  units: Record<UnitType, number>;
  // 已发现的野怪据点（id -> 当前强盗数）
  camps: Record<string, CampState>;
  // 地图上的 NPC 敌方部落（PVP 阶段1）
  players: Record<string, NpcVillage>;
  // 行军队列
  marchQueue: MarchMission[];
  // 科技等级（id -> 当前等级，0 = 未研发）
  techLevels: Partial<Record<TechType, number>>;
  // 研发队列（灵台一次只能研发一项）
  researchQueue: ResearchTask[];
  // 妖兽入侵：下次入侵时间戳
  nextInvasionAt: number;
  // 最近一次妖兽防御战报
  lastDefenseReport?: {
    time: number;
    raiderCount: number;
    raiderType: RaiderType;
    won: boolean;
    attackerLost: number;
    resourcesStolen: ResourceCost;
  };
  // 最近一次 PVP 防御战报（被 NPC 袭击）
  lastPvpDefenseReport?: PvpDefenseReport;
  // 跨玩家来袭战报（真实玩家进攻本村，由服务端写入）
  incomingAttacks?: IncomingAttack[];
  // 内部同步标记：记录最后一次写入该存档的客户端（用于识别自写回声）
  _w?: string;
  // 纹玉（高级货币，仅通过游戏行为获得，非充值）
  jade: number;
  // 今日已使用加速次数（每日重置，反P2W：硬上限）
  accelUsedToday: number;
  accelResetAt: number; // 下次重置时间戳
  // 已拥有的外观
  cosmetics: string[];
  // 当前装备的外观（按分类：旗帜/主题/边框）
  equippedCosmetics: Record<string, string | null>;
  // 赛季状态
  season: SeasonState;
  // 护盾状态：null=无护盾（可被攻击）
  shield: ShieldState | null;
  lastTick: number; // 上次资源结算的 ms timestamp
  lastSeen: number; // 上次玩家活跃的 ms timestamp（用于离线收益结算）
};

// 离线收益报告
export type OfflineReport = {
  offlineSeconds: number;
  gatheredResources: ResourceCost;
  patrolEvent: { raidersRepelled: number; cropSaved: number } | null;
  at: number;
};



// 训练任务
export type TrainTask = {
  id: string;
  unit: UnitType;
  count: number;       // 本次训练数量
  done: number;        // 已完成数量
  startAt: number;     // 第一只开始训练时间
  perUnitMs: number;   // 单只训练耗时（ms）
};

// 妖兽类型
export type RaiderType = 'demon' | 'mountainSpirit' | 'wolf' | 'serpent' | 'demonKing';

// 野怪据点
export type CampState = {
  id: string;
  name: string;
  raiderType: RaiderType;
  difficulty: 'small' | 'medium' | 'large';
  raiders: number;      // 当前妖兽数
  maxRaiders: number;   // 上限
  reward: ResourceCost; // 攻占奖励
  position: { x: number; y: number }; // 0-100 的相对坐标
  clearedAt?: number;   // 被清空时间戳（用于自动刷新）
  // 占领与驻守
  occupied?: boolean;              // 是否已被我方占领
  garrison?: Partial<Record<UnitType, number>>; // 驻守兵力
  // 侦查
  scouted?: boolean;               // 是否已侦查
  scoutedAt?: number;              // 侦查时间
};

// 行军任务（出征/撤回）
export type MarchMission = {
  id: string;
  campId: string;
  campName: string;
  kind: 'attack' | 'garrison' | 'recall' | 'pvpAttack' | 'pvpRaid' | 'realAttack';
  units: Partial<Record<UnitType, number>>;
  formation: FormationType;
  startAt: number;
  arriveAt: number;   // 到达时间
  status: 'marching' | 'arrived';
};

// NPC 敌方部落（PVP 阶段1：AI 村庄）
export type NpcVillage = {
  id: string;
  name: string;
  tribe: TribeType;
  position: { x: number; y: number };
  // 守军兵力（被攻击后会损耗，随时间恢复）
  units: Partial<Record<UnitType, number>>;
  // 守军基础兵力上限（恢复目标）
  baseUnits: Partial<Record<UnitType, number>>;
  // 城墙等级（提供防御加成与血量池）
  wallLevel: number;
  // 可掠夺资源
  resources: ResourceCost;
  // 资源上限（被掠夺后随时间恢复）
  resourceCap: ResourceCost;
  // 是否已侦查（侦查后可见准确兵力与资源）
  scouted: boolean;
  scoutedAt?: number;
  // 上次被攻击时间（用于恢复计时与反击判定）
  lastAttackedAt?: number;
  // 活跃标记：被击败后短暂"废墟"，随后恢复
  defeatedAt?: number;
};

// PVP 战报（攻击方视角）
export type PvpBattleReport = {
  id: string;
  win: boolean;
  targetId: string;
  targetName: string;
  targetTribe: TribeType;
  attackerLost: number;
  attackerLostByUnit: Partial<Record<UnitType, number>>;
  defenderLost: number;
  plundered: ResourceCost; // 掠夺到的资源
  formation: FormationType;
  at: number;
  side: 'attack' | 'defense'; // 我方是攻方还是守方
};

// PVP 防御战报（村庄被 NPC 袭击）
export type PvpDefenseReport = {
  time: number;
  attackerName: string;
  attackerTribe: TribeType;
  won: boolean;
  attackerLost: number;
  troopsLost: number;
  troopsLostByUnit: Partial<Record<UnitType, number>>;
  resourcesStolen: ResourceCost;
};

// 跨玩家来袭战报（守方视角，由服务端写入 village_data.incomingAttacks）
export type IncomingAttack = {
  id: string;
  time: number;
  attackerName: string;
  attackerTribe: TribeType;
  won: boolean; // 攻击方是否获胜
  plundered: ResourceCost; // 被掠夺资源
  troopsLost: number; // 我方守军损失
  troopsLostByUnit: Partial<Record<UnitType, number>>;
  seen?: boolean; // 是否已读（本地标记）
};

// 战斗报告
export type BattleReport = {
  win: boolean;
  attackerLost: number;           // 总损失
  attackerLostByUnit: Partial<Record<UnitType, number>>; // 分兵种损失
  defenderLost: number;
  reward: ResourceCost;
  campId: string;
  campName: string;
  formation: FormationType;
  at: number;
};


