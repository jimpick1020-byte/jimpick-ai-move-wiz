/**
 * 짐픽 3D 품목 아이콘.
 *
 * 파일은 public/assets/items-3d/<분류>/<이름>.webp 에 있습니다.
 * 화면에서는 <Icon3D> 를 쓰고, 연결이 없거나 파일을 못 찾으면
 * 깨진 그림 대신 기본 3D 박스가 나옵니다.
 */
import { useState } from "react";

const BASE = "/assets/items-3d";

/** 연결된 아이콘이 없을 때 쓰는 기본 그림 */
export const DEFAULT_ICON3D = `${BASE}/packing/moving-box-medium.webp`;

/** 품목 id → 아이콘 경로 */
export const ICON3D: Record<string, string> = {
  // ── 가전 ────────────────────────────────────────────────
  fridge: `${BASE}/appliances/four-door-refrigerator.webp`,
  kimchi: `${BASE}/appliances/kimchi-refrigerator.webp`,
  minifridge: `${BASE}/appliances/one-door-refrigerator.webp`,
  freezer: `${BASE}/appliances/chest-kimchi-refrigerator.webp`,
  winecellar: `${BASE}/appliances/wine-cellar.webp`,
  washer: `${BASE}/appliances/top-load-washer.webp`,
  drumwasher: `${BASE}/appliances/drum-washing-machine.webp`,
  dryer: `${BASE}/appliances/clothes-dryer.webp`,
  styler: `${BASE}/appliances/styler.webp`,
  tv: `${BASE}/appliances/television.webp`,
  bigtv: `${BASE}/appliances/television.webp`,
  walltv: `${BASE}/appliances/television.webp`,
  projector: `${BASE}/appliances/projector.webp`,
  speaker: `${BASE}/appliances/speakers.webp`,
  console: `${BASE}/appliances/game-console.webp`,
  aircon: `${BASE}/appliances/tower-air-conditioner.webp`,
  wallaircon: `${BASE}/appliances/wall-air-conditioner.webp`,
  airpurifier: `${BASE}/appliances/air-purifier.webp`,
  dehumid: `${BASE}/appliances/dehumidifier.webp`,
  humid: `${BASE}/appliances/humidifier.webp`,
  fan: `${BASE}/appliances/table-fan.webp`,
  heater: `${BASE}/appliances/fan-heater.webp`,
  electricmat: `${BASE}/living/bedding.webp`,
  pc: `${BASE}/appliances/desktop-computer.webp`,
  printer: `${BASE}/appliances/printer.webp`,
  vacuum: `${BASE}/appliances/cordless-vacuum.webp`,
  robotvac: `${BASE}/appliances/robot-vacuum.webp`,
  bidet: `${BASE}/appliances/bidet.webp`,
  sewing: `${BASE}/appliances/sewing-machine.webp`,

  // ── 주방 ────────────────────────────────────────────────
  microwave: `${BASE}/appliances/microwave.webp`,
  oven: `${BASE}/appliances/oven.webp`,
  airfryer: `${BASE}/kitchen/air-fryer.webp`,
  gasrange: `${BASE}/appliances/gas-range.webp`,
  induction: `${BASE}/appliances/induction-cooktop.webp`,
  dishwasher: `${BASE}/appliances/dishwasher.webp`,
  waterpurifier: `${BASE}/appliances/water-purifier.webp`,
  riceCooker: `${BASE}/appliances/rice-cooker.webp`,
  coffee: `${BASE}/appliances/coffee-machine.webp`,
  blender: `${BASE}/kitchen/blender.webp`,
  toaster: `${BASE}/appliances/toaster.webp`,
  kettle: `${BASE}/appliances/electric-kettle.webp`,
  dishrack: `${BASE}/kitchen/cutlery-tray.webp`,
  dishcabinet: `${BASE}/furniture/dish-cabinet.webp`,
  kitchencabinet: `${BASE}/furniture/kitchen-cabinet.webp`,
  potset: `${BASE}/kitchen/pot-set.webp`,
  ricebin: `${BASE}/kitchen/food-containers.webp`,
  kimchipot: `${BASE}/kitchen/food-containers.webp`,

  // ── 가구 — 침대 ─────────────────────────────────────────
  bed: `${BASE}/furniture/bed.webp`,
  bedq: `${BASE}/furniture/motion-bed.webp`,
  bunkbed: `${BASE}/furniture/bunk-bed.webp`,
  babybed: `${BASE}/furniture/baby-crib.webp`,
  mattress: `${BASE}/furniture/bed.webp`,

  // ── 가구 — 옷·수납 ──────────────────────────────────────
  wardrobe: `${BASE}/furniture/wardrobe.webp`,
  builtin: `${BASE}/furniture/walk-in-closet.webp`,
  hanger: `${BASE}/furniture/clothes-rack.webp`,
  vanity: `${BASE}/furniture/dressing-table.webp`,
  drawer: `${BASE}/furniture/chest-of-drawers.webp`,
  nightstand: `${BASE}/furniture/nightstand.webp`,

  // ── 가구 — 거실 ─────────────────────────────────────────
  sofa: `${BASE}/furniture/three-seat-sofa.webp`,
  sofabig: `${BASE}/furniture/corner-sofa.webp`,
  recliner: `${BASE}/furniture/recliner.webp`,
  floorsofa: `${BASE}/furniture/sofa-bed.webp`,
  tvstand: `${BASE}/furniture/tv-stand.webp`,
  teatable: `${BASE}/furniture/glass-coffee-table.webp`,
  displaycase: `${BASE}/furniture/display-cabinet.webp`,
  shoerack: `${BASE}/furniture/shoe-rack.webp`,

  // ── 가구 — 식탁·책상 ────────────────────────────────────
  table: `${BASE}/furniture/dining-table.webp`,
  table6: `${BASE}/furniture/long-dining-table.webp`,
  marbletable: `${BASE}/furniture/marble-round-table.webp`,
  island: `${BASE}/furniture/kitchen-island.webp`,
  chair: `${BASE}/furniture/chair.webp`,
  desk: `${BASE}/furniture/desk.webp`,
  officedesk: `${BASE}/furniture/student-desk.webp`,
  officechair: `${BASE}/furniture/office-chair.webp`,
  shelf: `${BASE}/furniture/bookshelf.webp`,
  wallshelf: `${BASE}/furniture/wall-cabinet.webp`,
  partition: `${BASE}/furniture/room-divider.webp`,
  foldtable: `${BASE}/furniture/folding-table.webp`,

  // ── 생활용품 ────────────────────────────────────────────
  drying: `${BASE}/packing/laundry-basket.webp`,
  curtain: `${BASE}/living/curtain.webp`,
  carpet: `${BASE}/living/carpet.webp`,
  cleaning: `${BASE}/living/cleaning-tools.webp`,
  toolbox: `${BASE}/living/toolbox.webp`,
  ladder2: `${BASE}/living/step-ladder.webp`,
  kickboard: `${BASE}/special/kick-scooter.webp`,
  golf: `${BASE}/special/golf-bag.webp`,
  ski: `${BASE}/special/ski-set.webp`,
  bag: `${BASE}/packing/luggage-set.webp`,
  vinyl: `${BASE}/packing/wrapping-material.webp`,
  waste: `${BASE}/packing/waste-disposal.webp`,
  standlight: `${BASE}/living/floor-lamp.webp`,
  mirror: `${BASE}/living/full-length-mirror.webp`,
  frame: `${BASE}/special/picture-frames.webp`,
  blanket: `${BASE}/living/bedding.webp`,
  storagebin: `${BASE}/packing/storage-basket.webp`,
  luggage: `${BASE}/furniture/trunk.webp`,
  plant: `${BASE}/living/plant.webp`,
  bigplant: `${BASE}/living/plant.webp`,
  bicycle: `${BASE}/special/exercise-bike.webp`,
  camping: `${BASE}/special/camping-gear.webp`,
  fitness: `${BASE}/special/bench-press.webp`,
  stroller: `${BASE}/special/stroller.webp`,
  babyitems: `${BASE}/furniture/baby-crib.webp`,
  petcage: `${BASE}/special/dog-house.webp`,
  cattower: `${BASE}/special/cat-tower.webp`,

  // ── 특수 ────────────────────────────────────────────────
  piano: `${BASE}/furniture/upright-piano.webp`,
  grandpiano: `${BASE}/special/grand-upright-piano.webp`,
  digitalpiano: `${BASE}/special/digital-piano.webp`,
  safe: `${BASE}/furniture/safe.webp`,
  aquarium: `${BASE}/furniture/aquarium.webp`,
  massagechair: `${BASE}/furniture/massage-chair.webp`,
  treadmill: `${BASE}/special/treadmill.webp`,
  bike2: `${BASE}/special/exercise-bike.webp`,
  art: `${BASE}/special/sculpture.webp`,

  // ── 잔짐·박스 ───────────────────────────────────────────
  box: `${BASE}/packing/moving-box-medium.webp`,
  clothbox: `${BASE}/packing/clothes-box.webp`,
  bigbox: `${BASE}/packing/moving-box-large.webp`,
  midbox: `${BASE}/packing/moving-box-medium.webp`,
  bookbox: `${BASE}/packing/moving-box-medium.webp`,
  kitchenbox: `${BASE}/packing/moving-box-medium.webp`,
  smallbox: `${BASE}/packing/moving-box-medium.webp`,
  basket: `${BASE}/packing/storage-basket.webp`,
  blanketbag: `${BASE}/living/bedding.webp`,
};

/** 이름에 이 말이 들어가면 이 아이콘 (긴 말부터) */
const NAME_ICON3D: { words: string[]; path: string }[] = [
  { words: ["김치냉장고"], path: ICON3D.kimchi },
  { words: ["냉동고"], path: ICON3D.freezer },
  { words: ["와인"], path: ICON3D.winecellar },
  { words: ["냉장고"], path: ICON3D.fridge },
  { words: ["드럼세탁기"], path: ICON3D.drumwasher },
  { words: ["세탁기"], path: ICON3D.washer },
  { words: ["건조기"], path: ICON3D.dryer },
  { words: ["스타일러"], path: ICON3D.styler },
  { words: ["tv", "티비", "텔레비"], path: ICON3D.tv },
  { words: ["프로젝터", "빔"], path: ICON3D.projector },
  { words: ["스피커", "오디오"], path: ICON3D.speaker },
  { words: ["벽걸이에어컨"], path: ICON3D.wallaircon },
  { words: ["에어컨"], path: ICON3D.aircon },
  { words: ["공기청정"], path: ICON3D.airpurifier },
  { words: ["제습"], path: ICON3D.dehumid },
  { words: ["가습"], path: ICON3D.humid },
  { words: ["선풍기"], path: ICON3D.fan },
  { words: ["히터", "온풍"], path: ICON3D.heater },
  { words: ["컴퓨터", "데스크탑", "피시"], path: ICON3D.pc },
  { words: ["노트북"], path: `${BASE}/appliances/laptop.webp` },
  { words: ["모니터"], path: `${BASE}/appliances/monitor.webp` },
  { words: ["프린터", "복합기"], path: ICON3D.printer },
  { words: ["로봇청소"], path: ICON3D.robotvac },
  { words: ["청소기"], path: ICON3D.vacuum },
  { words: ["전자레인지", "렌지"], path: ICON3D.microwave },
  { words: ["오븐"], path: ICON3D.oven },
  { words: ["에어프라이"], path: ICON3D.airfryer },
  { words: ["인덕션"], path: ICON3D.induction },
  { words: ["가스레인지"], path: ICON3D.gasrange },
  { words: ["식기세척"], path: ICON3D.dishwasher },
  { words: ["정수기"], path: ICON3D.waterpurifier },
  { words: ["밥솥"], path: ICON3D.riceCooker },
  { words: ["커피", "에스프레소"], path: ICON3D.coffee },
  { words: ["믹서", "블렌더"], path: ICON3D.blender },
  { words: ["토스터"], path: ICON3D.toaster },
  { words: ["포트", "주전자"], path: ICON3D.kettle },
  { words: ["냄비", "주방용품"], path: ICON3D.potset },
  { words: ["프라이팬"], path: `${BASE}/kitchen/frying-pan.webp` },
  { words: ["접시", "그릇"], path: `${BASE}/kitchen/dishes.webp` },
  { words: ["유리잔", "컵"], path: `${BASE}/kitchen/glassware.webp` },
  { words: ["수저"], path: `${BASE}/kitchen/cutlery-tray.webp` },
  { words: ["칼"], path: `${BASE}/kitchen/knife-block.webp` },
  { words: ["양념"], path: `${BASE}/kitchen/spice-jars.webp` },
  { words: ["반찬통", "밀폐"], path: `${BASE}/kitchen/food-containers.webp` },
  { words: ["그릴"], path: `${BASE}/kitchen/electric-grill.webp` },
  { words: ["생수", "정수"], path: `${BASE}/kitchen/water-dispenser.webp` },
  { words: ["모션침대"], path: ICON3D.bedq },
  { words: ["2층침대", "이층침대"], path: ICON3D.bunkbed },
  { words: ["아기침대", "유아침대"], path: ICON3D.babybed },
  { words: ["침대", "매트리스"], path: ICON3D.bed },
  { words: ["붙박이"], path: ICON3D.builtin },
  { words: ["장롱", "옷장"], path: ICON3D.wardrobe },
  { words: ["행거"], path: ICON3D.hanger },
  { words: ["화장대"], path: ICON3D.vanity },
  { words: ["서랍"], path: ICON3D.drawer },
  { words: ["협탁"], path: ICON3D.nightstand },
  { words: ["리클라이너"], path: ICON3D.recliner },
  { words: ["코너소파", "ㄱ자소파"], path: ICON3D.sofabig },
  { words: ["소파베드", "좌식소파"], path: ICON3D.floorsofa },
  { words: ["소파", "안락의자"], path: ICON3D.sofa },
  { words: ["티테이블"], path: ICON3D.teatable },
  { words: ["tv장", "거실장"], path: ICON3D.tvstand },
  { words: ["장식장", "진열장"], path: ICON3D.displaycase },
  { words: ["그릇장", "찬장"], path: ICON3D.dishcabinet },
  { words: ["신발장"], path: ICON3D.shoerack },
  { words: ["아일랜드"], path: ICON3D.island },
  { words: ["식탁"], path: ICON3D.table },
  { words: ["회의"], path: `${BASE}/furniture/conference-table.webp` },
  { words: ["사무용", "회전의자"], path: ICON3D.officechair },
  { words: ["스툴"], path: `${BASE}/furniture/stool.webp` },
  { words: ["벤치"], path: `${BASE}/furniture/bench.webp` },
  { words: ["의자"], path: ICON3D.chair },
  { words: ["게이밍"], path: `${BASE}/furniture/gaming-desk.webp` },
  { words: ["책상"], path: ICON3D.desk },
  { words: ["책장"], path: ICON3D.shelf },
  { words: ["선반", "수납장"], path: ICON3D.wallshelf },
  { words: ["파티션"], path: ICON3D.partition },
  { words: ["접이식"], path: ICON3D.foldtable },
  { words: ["건조대"], path: ICON3D.drying },
  { words: ["조명", "스탠드", "전등"], path: ICON3D.standlight },
  { words: ["탁상"], path: `${BASE}/living/table-lamp.webp` },
  { words: ["전신거울"], path: ICON3D.mirror },
  { words: ["거울"], path: `${BASE}/living/round-mirror.webp` },
  { words: ["액자", "그림"], path: ICON3D.frame },
  { words: ["이불", "침구"], path: ICON3D.blanket },
  { words: ["옷더미", "의류"], path: `${BASE}/living/folded-clothes.webp` },
  { words: ["정리함", "수납함", "바구니"], path: ICON3D.basket },
  { words: ["캐리어", "여행가방", "트렁크"], path: ICON3D.luggage },
  { words: ["화분", "식물"], path: ICON3D.plant },
  { words: ["자전거"], path: ICON3D.bicycle },
  { words: ["캠핑", "텐트"], path: ICON3D.camping },
  { words: ["러닝머신", "트레드밀"], path: ICON3D.treadmill },
  { words: ["운동기구", "역기", "벤치프레스"], path: ICON3D.fitness },
  { words: ["유모차"], path: ICON3D.stroller },
  { words: ["휠체어"], path: `${BASE}/special/wheelchair.webp` },
  { words: ["캣타워"], path: ICON3D.cattower },
  { words: ["케이지", "강아지", "개집"], path: ICON3D.petcage },
  { words: ["그랜드피아노"], path: ICON3D.grandpiano },
  { words: ["디지털피아노"], path: ICON3D.digitalpiano },
  { words: ["피아노"], path: ICON3D.piano },
  { words: ["기타"], path: `${BASE}/special/guitar.webp` },
  { words: ["첼로", "바이올린"], path: `${BASE}/special/cello.webp` },
  { words: ["드럼"], path: `${BASE}/special/drum-set.webp` },
  { words: ["금고"], path: ICON3D.safe },
  { words: ["어항", "수족관"], path: ICON3D.aquarium },
  { words: ["안마의자"], path: ICON3D.massagechair },
  { words: ["미술품", "조각", "도자기"], path: ICON3D.art },
  { words: ["괘종", "벽시계"], path: `${BASE}/furniture/grandfather-clock.webp` },
  { words: ["옷박스"], path: ICON3D.clothbox },
  { words: ["대박스"], path: ICON3D.bigbox },
  { words: ["박스", "상자"], path: ICON3D.box },
  { words: ["빨래"], path: `${BASE}/packing/laundry-basket.webp` },
  { words: ["비데"], path: ICON3D.bidet },
  { words: ["재봉"], path: ICON3D.sewing },
  { words: ["커튼", "블라인드"], path: ICON3D.curtain },
  { words: ["카펫", "러그", "매트"], path: ICON3D.carpet },
  { words: ["청소도구", "빗자루", "밀대", "걸레"], path: ICON3D.cleaning },
  { words: ["공구"], path: ICON3D.toolbox },
  { words: ["사다리"], path: ICON3D.ladder2 },
  { words: ["킥보드", "스쿠터"], path: ICON3D.kickboard },
  { words: ["골프"], path: ICON3D.golf },
  { words: ["스키", "스노보드"], path: ICON3D.ski },
  { words: ["가방", "백팩"], path: ICON3D.bag },
  { words: ["비닐", "포장재", "뽁뽁이"], path: ICON3D.vinyl },
  { words: ["폐기", "쓰레기"], path: ICON3D.waste },
];

const squash = (s: string) => (s || "").toLowerCase().replace(/\s/g, "");

/** 이름으로 3D 아이콘 찾기 */
export function guessIcon3d(name: string): string | undefined {
  const n = squash(name);
  if (!n) return undefined;
  for (const { words, path } of NAME_ICON3D) if (words.some((w) => n.includes(w))) return path;
  return undefined;
}

/** 품목 id·이름으로 아이콘 경로 정하기 (없으면 기본 박스) */
export function icon3dFor(id: string | undefined, name: string): string {
  return (id ? ICON3D[id] : undefined) ?? guessIcon3d(name) ?? DEFAULT_ICON3D;
}

/**
 * 3D 아이콘 한 개 그리기.
 * 파일을 못 찾으면 기본 3D 박스로 바꿔 깨진 그림이 보이지 않게 합니다.
 */
export function Icon3D({
  src,
  alt,
  size = 64,
  className = "",
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed ? DEFAULT_ICON3D : src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** 만들어 둔 아이콘 경로 목록 (개발 확인용) */
export const ICON3D_PATHS = Object.values(ICON3D);
