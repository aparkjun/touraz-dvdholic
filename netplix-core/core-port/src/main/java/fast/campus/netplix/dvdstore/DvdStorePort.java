package fast.campus.netplix.dvdstore;

import java.util.List;

public interface DvdStorePort {
    void saveAll(List<DvdStore> stores);

    void deleteAll();

    List<DvdStore> findAll();

    List<DvdStore> findByStatusCode(String statusCode);

    List<DvdStore> searchByKeyword(String keyword);

    List<DvdStore> findNearby(double lat, double lon, double radiusKm);

    long count();

    List<DvdStoreRegionStat> aggregateByRegion();
}
