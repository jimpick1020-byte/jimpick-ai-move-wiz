import { newEstimate, type Estimate } from "./jimpick";
import { strictFloor, type IntakeForm } from "./intake";

/** Translate only customer-owned fields; never mount the company store for a public link. */
export function intakeToEstimate(form: IntakeForm): Estimate {
  const base = newEstimate();
  const names = [...new Set([...(form.spaces ?? base.rooms.map(r => r.name)), ...Object.keys(form.rooms)])];
  return {
    ...base, id: "intake-current", customerName: form.customerName, phone: form.phone,
    moveDate: form.moveDate, moveTime: form.moveTime || "오전 09:00",
    moveType: form.moveType ?? base.moveType, storageEnabled: form.storageEnabled ?? false, memo: form.memo ?? "",
    fromAddress: form.fromAddress, fromDetail: form.fromDetail, toAddress: form.toAddress, toDetail: form.toDetail,
    fromX: form.fromX, fromY: form.fromY, toX: form.toX, toY: form.toY,
    fromJibun: form.fromJibun, fromZip: form.fromZip, toJibun: form.toJibun, toZip: form.toZip,
    fromEnv: form.fromEnv ?? base.fromEnv, toEnv: form.toEnv ?? base.toEnv,
    fromFloor: form.fromFloorEdited ? form.fromFloor ?? 1 : strictFloor(form.fromDetail) ?? 1,
    toFloor: form.toFloorEdited ? form.toFloor ?? 1 : strictFloor(form.toDetail) ?? 1,
    fromFloorEdited: form.fromFloorEdited, toFloorEdited: form.toFloorEdited,
    ladderFrom: form.ladderFrom ?? false, ladderTo: form.ladderTo ?? false,
    sizeTab: form.fromSize || base.sizeTab,
    rooms: names.map(name => ({ id: `r_${name}`, name,
      items: Object.fromEntries(Object.entries(form.rooms[name] ?? {}).map(([id, pick]) => [id, pick.qty])),
      disposal: Object.fromEntries(Object.entries(form.rooms[name] ?? {}).filter(([, pick]) => pick.disposal).map(([id]) => [id, true])),
    })),
  };
}

export function estimateToIntake(draft: Estimate, previous: IntakeForm): IntakeForm {
  return {
    ...previous, customerName: draft.customerName, phone: draft.phone, moveDate: draft.moveDate, moveTime: draft.moveTime,
    moveType: draft.moveType, storageEnabled: draft.storageEnabled, memo: draft.memo,
    fromAddress: draft.fromAddress, fromDetail: draft.fromDetail, toAddress: draft.toAddress, toDetail: draft.toDetail,
    fromX: draft.fromX, fromY: draft.fromY, toX: draft.toX, toY: draft.toY,
    fromJibun: draft.fromJibun, fromZip: draft.fromZip, toJibun: draft.toJibun, toZip: draft.toZip,
    fromEnv: draft.fromEnv, toEnv: draft.toEnv, fromFloor: draft.fromFloor, toFloor: draft.toFloor,
    fromFloorEdited: draft.fromFloorEdited, toFloorEdited: draft.toFloorEdited,
    ladderFrom: draft.ladderFrom, ladderTo: draft.ladderTo,
    fromSize: draft.sizeTab, spaces: draft.rooms.map(r => r.name),
    rooms: Object.fromEntries(draft.rooms.map(r => [r.name, Object.fromEntries(Object.entries(r.items).filter(([, qty]) => qty > 0).map(([id, qty]) => [id, { qty, disposal: !!r.disposal?.[id] }]))])),
  };
}