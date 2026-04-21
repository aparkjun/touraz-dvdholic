package fast.campus.netplix.dvdstore;

import java.util.List;

public interface DvdStoreUseCase {
    List<DvdStore> getAllStores();

    List<DvdStore> getOperatingStores();

    List<DvdStore> search(String keyword);

    long getStoreCount();

    List<DvdStore> findNearby(double lat, double lon, double radiusKm);

    String loadFromCsvContent(String csvContent);

    int refreshFromApi();

    List<DvdStoreRegionStat> getRegionStats();
}
