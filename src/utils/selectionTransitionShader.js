export function syncSelectedCountryShaderUniforms({
  shader,
  isLight,
  isBlackoutTheme,
  isError,
  isSuccess,
  isFound,
}) {
  if (!shader?.uniforms) return;
  if (shader.uniforms.uFadeProgress) {
    shader.uniforms.uFadeProgress.value = 0.0;
  }
  if (shader.uniforms.uSelectInTransition) {
    shader.uniforms.uSelectInTransition.value = 0.0;
  }
  if (shader.uniforms.uIsError) {
    shader.uniforms.uIsError.value = isError ? 1.0 : 0.0;
  }
  if (shader.uniforms.uIsSuccess) {
    shader.uniforms.uIsSuccess.value = isSuccess ? 1.0 : 0.0;
  }
  if (shader.uniforms.uIsSelection) {
    shader.uniforms.uIsSelection.value = 0.0;
  }
  if (shader.uniforms.uIsLight) {
    shader.uniforms.uIsLight.value = isLight ? 1.0 : 0.0;
  }
  if (shader.uniforms.uTheme) {
    shader.uniforms.uTheme.value = isBlackoutTheme ? 1.0 : 0.0;
  }
  if (shader.uniforms.uIsFound) {
    shader.uniforms.uIsFound.value = isFound ? 1.0 : 0.0;
  }
}