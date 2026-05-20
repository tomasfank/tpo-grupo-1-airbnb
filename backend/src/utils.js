export const ok   = (res, data, status = 200) => res.status(status).json({ ok: true, data });
export const fail = (res, status, message)    => res.status(status).json({ ok: false, message });

export const overlap = (aStart, aEnd, bStart, bEnd) =>
  new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);

export const nightsBetween = (start, end) =>
  Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));

export const distanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
