/**
 * Feature switches for capabilities that aren't built yet.
 * The UI only shows an entry point once the feature actually works.
 */
export const features = {
  assistant: process.env.NEXT_PUBLIC_FEATURE_ASSISTANT === "1",
  /**
   * Online payment for MOTORNA Care. Off: there is no payment provider. Booking itself is gated
   * per center by the admin-only pilot switch (center_booking_settings.pilot_enabled), off by default.
   */
  careBooking: false,
} as const;
