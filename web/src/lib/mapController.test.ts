import { describe, expect, test } from "bun:test";
import {
  locateActiveMap,
  registerMapController,
  setActiveMap3D,
  zoomActiveMap,
  type MapController,
} from "./mapController";

describe("active map controller", () => {
  test("routes controls to the current renderer and ignores stale cleanup", () => {
    const calls: string[] = [];
    const first: MapController = {
      locate: () => calls.push("first:locate"),
      set3D: (on) => calls.push(`first:3d:${on}`),
      zoomBy: (delta) => calls.push(`first:zoom:${delta}`),
    };
    const second: MapController = {
      locate: () => calls.push("second:locate"),
      set3D: (on) => calls.push(`second:3d:${on}`),
      zoomBy: (delta) => calls.push(`second:zoom:${delta}`),
    };

    const unregisterFirst = registerMapController(first);
    const unregisterSecond = registerMapController(second);
    unregisterFirst();
    locateActiveMap();
    setActiveMap3D(true);
    zoomActiveMap(1);
    unregisterSecond();

    expect(calls).toEqual(["second:locate", "second:3d:true", "second:zoom:1"]);
  });
});
