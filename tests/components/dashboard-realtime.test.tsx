import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  removeChannel: vi.fn().mockResolvedValue(undefined),
  setAuth: vi.fn().mockResolvedValue(undefined),
  handler: undefined as (() => void) | undefined,
}));
const channel = {
  on: vi.fn((_type: string, _filter: unknown, handler: () => void) => {
    mocks.handler = handler;
    return channel;
  }),
  subscribe: vi.fn(),
};
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/platform/supabase/client", () => ({
  createClient: () => ({
    channel: vi.fn().mockReturnValue(channel),
    realtime: { setAuth: mocks.setAuth },
    removeChannel: mocks.removeChannel,
  }),
}));

import { DashboardRealtime } from "@/app/(operator)/operator/dashboard-realtime";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("dashboard realtime", () => {
  it("subscribes to the exact private restaurant topic and refreshes authoritatively", async () => {
    vi.useFakeTimers();
    render(<DashboardRealtime restaurantId="27" />);
    await act(async () => Promise.resolve());
    expect(mocks.setAuth).toHaveBeenCalled();
    expect(channel.subscribe).toHaveBeenCalled();

    act(() => mocks.handler?.());
    await act(async () => vi.advanceTimersByTimeAsync(80));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
