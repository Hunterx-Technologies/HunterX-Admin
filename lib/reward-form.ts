import type { CouponInput } from '@/types/reward';

// Turns the coupon dialog's state into the multipart body the backend's
// coupon create/update endpoints take (see HunterX-Backend
// src/routes/admin.js). An empty string clears a field, e.g. no quantity
// limit. Built in the browser so the picked image File can ride along.

// <input type="date"> gives YYYY-MM-DD; a coupon is valid from the start
// of valid_from through the end of valid_until (UTC).
const dayStart = (v: string) => (v ? `${v}T00:00:00.000Z` : '');
const dayEnd = (v: string) => (v ? `${v}T23:59:59.999Z` : '');

export function buildCouponFormData(input: CouponInput): FormData {
  const fd = new FormData();
  fd.append('title', input.title.trim());
  fd.append('coupon_code', input.couponCode.trim());
  fd.append('discount_type', input.discountType);
  fd.append('discount_value', input.discountValue.trim());
  fd.append('currency', input.discountType === 'FLAT' ? input.currency.trim() : '');
  fd.append('weight', input.weight.trim() || '1');
  fd.append('total_quantity', input.totalQuantity.trim());
  fd.append('valid_from', dayStart(input.validFrom));
  fd.append('valid_until', dayEnd(input.validUntil));
  fd.append('valid_days_after_award', input.validDaysAfterAward.trim());
  fd.append('description', input.description.trim());
  fd.append('product_name', input.productName.trim());
  fd.append('product_category', input.productCategory.trim());
  fd.append('is_active', String(input.isActive));
  if (input.imageFile) fd.append('product_image', input.imageFile);
  else if (input.removeImage) fd.append('remove_product_image', 'true');
  return fd;
}
