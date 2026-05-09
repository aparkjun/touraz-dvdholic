package fast.campus.netplix.kma;

/**
 * 위경도로부터 가장 가까운 단기예보 reg 선택.
 */
public final class KmaNearestReg {

    private KmaNearestReg() {
    }

    public record Resolution(String reg, String label, double distanceKm) {
    }

    public static Resolution resolve(double lat, double lng) {
        if (!Double.isFinite(lat) || !Double.isFinite(lng)) {
            return null;
        }
        if (lat < 33 || lat > 43 || lng < 124 || lng > 132) {
            return null;
        }
        String bestReg = KmaRegCentroid.SEOUL_GANGNAM.reg();
        String bestLabel = KmaRegCentroid.SEOUL_GANGNAM.label();
        double bestD = Double.MAX_VALUE;
        for (KmaRegCentroid c : KmaRegCentroid.values()) {
            double d = haversineKm(lat, lng, c.lat(), c.lng());
            if (d < bestD) {
                bestD = d;
                bestReg = c.reg();
                bestLabel = c.label();
            }
        }
        return new Resolution(bestReg, bestLabel, bestD);
    }

    private static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
