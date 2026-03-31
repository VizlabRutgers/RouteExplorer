from setuptools import setup

setup(description='MANET Visualizer',
      name='routeexplorer',
      author='Eric Schreiber',
      version='0.1.1',
      author_email='eric.schreiber at rutgers dot edu',
      license='BSD',
      url='https://gitlab.com/eschreib/routeexplorer',
      packages=['routeexplore'],
      scripts=['scripts/rexp-add-metrics',
               'scripts/rexp-annotate',
               'scripts/rexp-distance-grid',
               'scripts/rexp-parse-logs',
               'scripts/rexp-plot-motion',
               'scripts/rexp-plot-receptions',
               'scripts/rexp-plot-route-counts',
               'scripts/rexp-run-ns3-routing-simulation',
               'scripts/rexp-txt2sqlite'])
