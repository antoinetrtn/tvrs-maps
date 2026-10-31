import { act, render, renderHook, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import AchievementStack from "../components/AchievementStack.jsx";
import useAchievementToasts, { ACHIEVEMENT_STACK_MAX } from "../hooks/useAchievementToasts.jsx";

describe("pile des succès", () => {
  it("file unique ordonnée, au plus 3 visibles, le suivant remplace le premier fermé", () => {
    const { result } = renderHook(() => useAchievementToasts());
    act(() => {
      for (let i = 1; i <= 4; i++) result.current.addAchievementToQueue({ title: `S${i}` });
    });
    expect(result.current.achievements.map((a) => a.title)).toEqual(["S1", "S2", "S3"]);
    expect(ACHIEVEMENT_STACK_MAX).toBe(3);
    act(() => result.current.dismissAchievement(result.current.achievements[0].id));
    expect(result.current.achievements.map((a) => a.title)).toEqual(["S2", "S3", "S4"]);
  });

  it.each([1, 2, 3])("affiche %i succès empilés avec un index de cascade", (n) => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const list = Array.from({ length: n }, (_, i) => ({ id: i + 1, title: `S${i + 1}` }));
    const { container } = render(<AchievementStack achievements={list} onDismiss={onDismiss} />);
    const items = container.querySelectorAll(".achievement-stack-item");
    expect(items).toHaveLength(n);
    items.forEach((el, i) => expect(el.style.getPropertyValue("--i")).toBe(String(i)));
    expect(screen.getByText("S1")).toBeTruthy();
    act(() => vi.advanceTimersByTime(4000));
    expect(onDismiss).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });
});
