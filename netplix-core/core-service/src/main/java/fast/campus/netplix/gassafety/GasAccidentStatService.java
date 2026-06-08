package fast.campus.netplix.gassafety;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 가스사고발생통계 서비스. 캐싱·외부 호출은 어댑터(SafemapGasStatHttpClient)에서 관리.
 */
@Service
@RequiredArgsConstructor
public class GasAccidentStatService implements GetGasAccidentStatUseCase {

    private final GasAccidentStatPort port;

    @Override
    public List<GasAccidentStat> sigunguStats() {
        return port.fetchSigunguStats();
    }
}
