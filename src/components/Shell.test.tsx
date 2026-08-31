// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoBrand } from "../domain/demo";
import Shell from "./Shell";

describe("shell navigation",()=>{afterEach(cleanup);it("keeps School Studio reachable for leadership on compact navigation",()=>{const onView=vi.fn();render(<Shell brand={demoBrand} viewer={{name:"Principal",email:"principal@example.test",role:"principal"}} view="academics" onView={onView} signalCount={0} onFeedback={vi.fn()}><div>Academic content</div></Shell>);fireEvent.click(screen.getByRole("button",{name:"School Studio"}));expect(onView).toHaveBeenCalledWith("studio")});
it("does not expose School Studio to teachers",()=>{render(<Shell brand={demoBrand} viewer={{name:"Teacher",email:"teacher@example.test",role:"teacher"}} view="operations" onView={vi.fn()} signalCount={0} onFeedback={vi.fn()}><div>Teacher content</div></Shell>);expect(screen.queryByRole("button",{name:"School Studio"})).not.toBeInTheDocument()})});
