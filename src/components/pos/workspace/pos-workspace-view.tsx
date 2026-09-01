"use client";

import type { ComponentProps } from "react";

import { CameraScannerModal } from "@/components/scanner/camera-scanner-modal";
import { PosCartContent } from "@/components/pos/workspace/pos-cart-content";
import { PosCatalogPanel } from "@/components/pos/workspace/pos-catalog-panel";
import { PosCheckoutSuccessContent } from "@/components/pos/workspace/pos-checkout-success-content";
import { PosItemPricingDialog } from "@/components/pos/workspace/pos-item-pricing-dialog";
import { PosHoldCartDialog } from "@/components/pos/workspace/pos-hold-cart-dialog";
import {
  PosMobileSidePanel,
  type PosPanelMode,
} from "@/components/pos/workspace/pos-mobile-side-panel";
import { PosPaymentPanel } from "@/components/pos/workspace/pos-payment-panel";
import { PosQuickCustomerDialog } from "@/components/pos/workspace/pos-quick-customer-dialog";
import {
  PosCloseShiftCard,
  PosContextNotice,
  PosOpenShiftCard,
  PosReopenShiftCard,
} from "@/components/pos/workspace/pos-shift-controls";
import type { PosOperationalContext } from "@/features/pos/contracts";
import { getPosWorkspacePanelContent } from "@/features/pos/workspace-state";

type PosCatalogProps = Omit<
  ComponentProps<typeof PosCatalogPanel>,
  "children"
>;

type PosWorkspaceDialogs = {
  quickCustomer: ComponentProps<typeof PosQuickCustomerDialog> | null;
  itemPricing: ComponentProps<typeof PosItemPricingDialog> | null;
  holdCart: ComponentProps<typeof PosHoldCartDialog> | null;
};

type PosWorkspaceShiftProps = {
  context: PosOperationalContext;
  canManageShifts: boolean;
  canContinueShift: boolean;
  isCloseShiftPanelOpen: boolean;
  onToggleCloseShiftPanel: () => void;
  onCloseShiftPanel: () => void;
};

type PosWorkspaceSidePanelProps = {
  isMobileOpen: boolean;
  mode: PosPanelMode;
  itemCount: number;
  totalAmount: number;
  cart: ComponentProps<typeof PosCartContent>;
  payment: ComponentProps<typeof PosPaymentPanel>;
  success: ComponentProps<typeof PosCheckoutSuccessContent> | null;
  onOpenMobile: () => void;
  onCloseMobile: () => void;
};

export type PosWorkspaceViewProps = {
  dialogs: PosWorkspaceDialogs;
  catalog: PosCatalogProps;
  shifts: PosWorkspaceShiftProps;
  sidePanel: PosWorkspaceSidePanelProps;
  scanner: ComponentProps<typeof CameraScannerModal>;
};

export function PosWorkspaceView({
  dialogs,
  catalog,
  shifts,
  sidePanel,
  scanner,
}: PosWorkspaceViewProps) {
  const panelContent = getPosWorkspacePanelContent(
    sidePanel.mode,
    Boolean(sidePanel.success),
  );
  const sidePanelContent =
    panelContent === "success" && sidePanel.success ? (
      <PosCheckoutSuccessContent {...sidePanel.success} />
    ) : panelContent === "payment" ? (
      <PosPaymentPanel {...sidePanel.payment} />
    ) : (
      <PosCartContent {...sidePanel.cart} />
    );

  return (
    <>
      {dialogs.quickCustomer ? (
        <PosQuickCustomerDialog {...dialogs.quickCustomer} />
      ) : null}

      {dialogs.itemPricing ? (
        <PosItemPricingDialog {...dialogs.itemPricing} />
      ) : null}

      {dialogs.holdCart ? <PosHoldCartDialog {...dialogs.holdCart} /> : null}

      <div className="lg:grid lg:h-[calc(100vh-7.5rem)] lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
        <PosCatalogPanel {...catalog}>
          <PosContextNotice
            context={shifts.context}
            canManageShifts={shifts.canManageShifts}
            canContinueShift={shifts.canContinueShift}
            isCloseShiftPanelOpen={shifts.isCloseShiftPanelOpen}
            onCloseShiftClick={shifts.onToggleCloseShiftPanel}
          />

          {shifts.canContinueShift && shifts.context.reopenCandidate ? (
            <PosReopenShiftCard context={shifts.context} />
          ) : null}

          {shifts.canManageShifts && !shifts.context.reopenCandidate ? (
            <PosOpenShiftCard context={shifts.context} />
          ) : null}

          {shifts.canManageShifts &&
          shifts.isCloseShiftPanelOpen &&
          shifts.context.activeShift ? (
            <PosCloseShiftCard
              context={shifts.context}
              onCancel={shifts.onCloseShiftPanel}
            />
          ) : null}
        </PosCatalogPanel>

        <aside className="hidden min-h-0 overflow-y-auto bg-white lg:block">
          {sidePanelContent}
        </aside>
      </div>

      <PosMobileSidePanel
        isOpen={sidePanel.isMobileOpen}
        mode={sidePanel.mode}
        itemCount={sidePanel.itemCount}
        totalAmount={sidePanel.totalAmount}
        onOpen={sidePanel.onOpenMobile}
        onClose={sidePanel.onCloseMobile}
      >
        {sidePanelContent}
      </PosMobileSidePanel>

      <CameraScannerModal {...scanner} />
    </>
  );
}
