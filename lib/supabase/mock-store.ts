import { mockEmployees, mockShifts } from "@/lib/mock-data";
import type { Employee, Shift } from "@/lib/types";

type MockStore = {
  employees: Employee[];
  shifts: Shift[];
};

declare global {
  var __SKIFT_MOCK_DATA_STORE__: MockStore | undefined;
}

export function getMockDataStore(): MockStore {
  if (!globalThis.__SKIFT_MOCK_DATA_STORE__) {
    globalThis.__SKIFT_MOCK_DATA_STORE__ = {
      employees: [...mockEmployees],
      shifts: [...mockShifts],
    };
  }
  return globalThis.__SKIFT_MOCK_DATA_STORE__;
}
