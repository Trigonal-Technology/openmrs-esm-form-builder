// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
const config = (module.exports = require('openmrs/default-webpack-config'));

// Dev shell loads MF from http://localhost:<port+1>/… ; bind on all interfaces and allow any Host
// so LAN access works when OMRS_DEV_MFE_ORIGIN is set (see node_modules/openmrs importmap patch).
config.devServer = {
  ...config.devServer,
  host: '0.0.0.0',
  allowedHosts: 'all',
};

config.overrides.resolve = {
  extensions: ['.tsx', '.ts', '.jsx', '.js', '.scss', '.json'],
  alias: {
    '@hooks': path.resolve(__dirname, 'src/hooks/'),
    '@types$': path.resolve(__dirname, 'src/types.ts'),
    '@resources': path.resolve(__dirname, 'src/resources/'),
    '@tools': path.resolve(__dirname, 'tools/'),
    '@constants$': path.resolve(__dirname, 'src/constants.ts'),
  },
};
module.exports = config;
