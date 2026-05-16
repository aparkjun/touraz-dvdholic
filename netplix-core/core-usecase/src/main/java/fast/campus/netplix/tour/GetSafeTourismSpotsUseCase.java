package fast.campus.netplix.tour;

public interface GetSafeTourismSpotsUseCase {

    SafeTourismPage list(int page, int perPage, String areaKeyword, String q);
}
