module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"], // The correct format is an array of strings.
  };
};