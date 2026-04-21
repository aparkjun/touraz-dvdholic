package fast.campus.netplix.repository.dvdstore;

/**
 * JPA native projection for aggregateByRegion query.
 */
public interface DvdStoreRegionStatRow {
    String getAreaCode();
    Long getTotalCount();
    Long getOperatingCount();
    Long getClosedCount();
    Double getAvgLatitude();
    Double getAvgLongitude();
}
