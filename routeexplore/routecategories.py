from enum import Enum


MajorRouteCategories = (
    'valid',
    'loop',
    'incomplete',
    'broken',
    'noroute'
)


class RouteCategories(Enum):
    VALID1 = 1
    VALID2 = 2
    VALID3 = 3
    VALID4 = 4
    VALID5 = 5
    VALID6 = 6
    VALID7 = 7
    VALID8 = 8
    VALID9 = 9
    VALID10 = 10
    LOOP = 11
    INCOMPLETE = 12
    BROKEN = 13
    NOROUTE = 14


    @classmethod
    def toValue(cls, major_category, hopcount):
        hc = min(max(0, hopcount), RouteCategories.VALID10.value)

        cat = f'VALID{hc}' if major_category == 'valid' else major_category.upper()

        return RouteCategories[cat].value


    @classmethod
    def toCatHopcount(cls, value):
        if value < RouteCategories.LOOP.value:
            return ('valid', value)

        return (RouteCategories(value).name.lower(), 0)


    @classmethod
    def toField(cls, major_category, hopcount):
        return RouteCategories(cls.toValue(major_category, hopcount)).name.lower()
