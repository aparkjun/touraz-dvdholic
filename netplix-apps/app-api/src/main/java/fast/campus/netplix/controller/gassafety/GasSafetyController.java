package fast.campus.netplix.controller.gassafety;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.gassafety.GetGasAccidentStatUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 행정안전부 생활안전지도 가스사고발생통계(IF_0064) 공용 조회 API.
 *
 * <p>GET /api/v1/gas-safety/sigungu — 시군구 단위 가스사고 발생건수(내림차순).
 * 키 미설정/미등록 시 빈 배열 반환(프런트는 안내 문구 표시).
 */
@RestController
@RequestMapping("/api/v1/gas-safety")
@RequiredArgsConstructor
public class GasSafetyController {

    private final GetGasAccidentStatUseCase useCase;

    @GetMapping("/sigungu")
    public NetplixApiResponse<List<GasAccidentStatResponse>> sigungu() {
        List<GasAccidentStatResponse> body = useCase.sigunguStats().stream()
                .map(GasAccidentStatResponse::from)
                .toList();
        return NetplixApiResponse.ok(body);
    }
}
