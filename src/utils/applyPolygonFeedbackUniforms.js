import { getFoundGreenThreeColor } from "./foundGreenPalette";
import { polygonGlitchUniforms } from "./polygonGlitchShader";

/** Push success/error flags to cached polygon shaders without waiting for React. */
export function applyPolygonFeedbackUniforms({
  polygonMaterialCacheRef,
  admin,
  isError = false,
  isSuccess = false,
  mountainGlitchUniforms,
}) {
  if (!admin || !polygonMaterialCacheRef?.current) return;

  const time = performance.now() / 1000;
  polygonGlitchUniforms.uTime.value = time;
  if (isError || isSuccess) {
    polygonGlitchUniforms.uFoundGreen.value.copy(getFoundGreenThreeColor());
  }

  ["cap", "side"].forEach((kind) => {
    const mat = polygonMaterialCacheRef.current[kind]?.get(admin);
    const shader = mat?.userData?.shader;
    if (!shader?.uniforms) return;
    if (shader.uniforms.uIsError) {
      shader.uniforms.uIsError.value = isError ? 1.0 : 0.0;
    }
    if (shader.uniforms.uIsSuccess) {
      shader.uniforms.uIsSuccess.value = isSuccess ? 1.0 : 0.0;
    }
    if (shader.uniforms.uIsSelection) {
      shader.uniforms.uIsSelection.value = 0.0;
    }
  });

  if (mountainGlitchUniforms) {
    mountainGlitchUniforms.uTime.value = time;
    mountainGlitchUniforms.uIsError.value = isError ? 1.0 : 0.0;
    mountainGlitchUniforms.uIsSuccess.value = isSuccess ? 1.0 : 0.0;
    if (isError || isSuccess) {
      mountainGlitchUniforms.uFoundGreen.value.copy(getFoundGreenThreeColor());
    }
  }
}
